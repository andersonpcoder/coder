"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toDateInput } from "./dates";
import { listMemberships, loadCompany, type Membership } from "./db/load";
import type { CollectionName, Collections } from "./db/mappers";
import { persist, type Mutation } from "./db/persist";
import { subscribeCompany, type RemoteEvent } from "./db/realtime";
import { buildDataset, type Dataset } from "./mock-data";
import { createClient, errorMessage, isDemoMode } from "./supabase/client";
import type { Company, Message, Subscription } from "./types";

// Estado do app. No modo demonstração os dados ficam no navegador; com o
// Supabase configurado, o estado é carregado do banco, cada mudança é gravada
// (com atualização otimista) e o Realtime mantém as telas sincronizadas.

const STORAGE_KEY = "balcao:demo:v2";
const COMPANY_KEY = "balcao:empresa";

export type Mode = "demo" | "supabase";

export interface State extends Dataset {
  generatedFor: string;
  currentUserId: string;
  /** Última senha chamada nesta sessão, exibida no painel de TV. */
  lastCallId?: string;
  /** Unidade selecionada; vazio mostra todas. */
  currentUnitId?: string;
}

type AnyItem = { id: string } & Record<string, unknown>;

type Action =
  | { type: "replace"; state: State }
  | { type: "setUser"; userId: string }
  | { type: "setUnit"; unitId?: string }
  | { type: "setLastCall"; id: string }
  | { type: "upsert"; collection: CollectionName; items: AnyItem[] }
  | { type: "patch"; collection: CollectionName; id: string; patch: Record<string, unknown> }
  | { type: "remove"; collection: CollectionName; ids: string[] }
  | { type: "addMessage"; conversationId: string; message: Message }
  | { type: "patchCompany"; patch: Partial<Company> }
  | { type: "setSubscription"; subscription: Subscription }
  | { type: "readNotifications" };

/** Mescla ignorando chaves undefined, para não apagar campos que o evento não trouxe. */
function merge<T extends object>(base: T, incoming: Partial<T>): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(incoming)) if (v !== undefined) out[k] = v;
  return out as T;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "replace":
      return action.state;
    case "setUser":
      return { ...state, currentUserId: action.userId };
    case "setUnit":
      return { ...state, currentUnitId: action.unitId };
    case "setLastCall":
      return { ...state, lastCallId: action.id };
    case "upsert": {
      const list = state[action.collection] as unknown as AnyItem[];
      const byId = new Map(list.map((x) => [x.id, x]));
      for (const item of action.items) {
        const existing = byId.get(item.id);
        byId.set(item.id, existing ? merge(existing, item) : ({ messages: action.collection === "conversations" ? [] : undefined, ...item } as AnyItem));
      }
      return { ...state, [action.collection]: [...byId.values()] };
    }
    case "patch": {
      const list = state[action.collection] as unknown as AnyItem[];
      return {
        ...state,
        [action.collection]: list.map((x) => (x.id === action.id ? ({ ...x, ...action.patch } as AnyItem) : x)),
      };
    }
    case "remove": {
      const list = state[action.collection] as unknown as AnyItem[];
      return { ...state, [action.collection]: list.filter((x) => !action.ids.includes(x.id)) };
    }
    case "addMessage":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId && !c.messages.some((m) => m.id === action.message.id)
            ? { ...c, messages: [...c.messages, action.message], lastMessageAt: action.message.at }
            : c,
        ),
      };
    case "patchCompany":
      return { ...state, company: { ...state.company, ...action.patch } };
    case "setSubscription":
      return { ...state, subscription: action.subscription };
    case "readNotifications":
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };
  }
}

function freshDemoState(): State {
  return { ...buildDataset(), generatedFor: toDateInput(new Date()), currentUserId: "u-ana" };
}

function loadDemoState(): State {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      // Os dados de exemplo são relativos ao dia; regenera ao virar o dia.
      if (parsed.generatedFor === toDateInput(new Date())) return parsed;
    }
  } catch {
    // Armazenamento indisponível (aba anônima, bloqueado): segue sem persistir.
  }
  return freshDemoState();
}

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "sucesso" | "erro";
}

/** Operações de escrita. Retornam false se o banco recusou (o estado é recarregado). */
export interface Db {
  upsert<C extends CollectionName>(collection: C, items: Collections[C][]): Promise<boolean>;
  patch<C extends CollectionName>(collection: C, id: string, patch: Partial<Collections[C]>): Promise<boolean>;
  remove<C extends CollectionName>(collection: C, ids: string[]): Promise<boolean>;
  addMessage(conversationId: string, message: Message): Promise<boolean>;
  patchCompany(patch: Partial<Company>): Promise<boolean>;
  readNotifications(): Promise<boolean>;
}

interface StoreValue {
  state: State;
  mode: Mode;
  /** Cliente do Supabase; nulo no modo demonstração. */
  supabase: SupabaseClient | null;
  memberships: Membership[];
  db: Db;
  dispatch: (action: Action) => void;
  reset: () => void;
  refresh: () => Promise<void>;
  switchCompany: (companyId: string) => void;
  toasts: Toast[];
  toast: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: number) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => null as unknown as State);
  const [status, setStatus] = useState<"carregando" | "pronto" | "erro">("carregando");
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<Mode>("demo");
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const fromOtherTab = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => (isDemoMode() ? null : createClient()), []);

  const toast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const loadFromSupabase = useCallback(
    async (preferredCompany?: string) => {
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace(`/entrar?proximo=${encodeURIComponent(pathname)}`);
        return;
      }
      const list = await listMemberships(supabase, data.user.id);
      setMemberships(list);
      if (!list.length) {
        router.replace("/onboarding");
        return;
      }
      let saved: string | null = null;
      try {
        saved = preferredCompany ?? window.localStorage.getItem(COMPANY_KEY);
      } catch {
        saved = preferredCompany ?? null;
      }
      const companyId = list.find((m) => m.companyId === saved)?.companyId ?? list[0].companyId;
      const dataset = await loadCompany(supabase, companyId);
      const prev = stateRef.current;
      dispatch({
        type: "replace",
        state: {
          ...dataset,
          generatedFor: toDateInput(new Date()),
          currentUserId: data.user.id,
          lastCallId: prev?.company.id === companyId ? prev.lastCallId : undefined,
          currentUnitId: prev?.company.id === companyId ? prev.currentUnitId : undefined,
        },
      });
      try {
        window.localStorage.setItem(COMPANY_KEY, companyId);
      } catch {
        // Sem preferência salva; a primeira empresa é usada.
      }
      setStatus("pronto");
    },
    [supabase, router, pathname],
  );

  useEffect(() => {
    if (!supabase) {
      setMode("demo");
      dispatch({ type: "replace", state: loadDemoState() });
      setStatus("pronto");
      // Sincroniza abas abertas (ex.: painel de TV da fila), simulando o tempo real.
      const onStorage = (e: StorageEvent) => {
        if (e.key !== STORAGE_KEY || !e.newValue) return;
        try {
          fromOtherTab.current = true;
          dispatch({ type: "replace", state: JSON.parse(e.newValue) as State });
        } catch {
          fromOtherTab.current = false;
        }
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    }
    setMode("supabase");
    loadFromSupabase().catch((e) => {
      setLoadError(errorMessage(e));
      setStatus("erro");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/entrar");
    });
    return () => sub.subscription.unsubscribe();
    // Carrega uma vez por montagem; a troca de empresa chama loadFromSupabase direto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Realtime: aplica mudanças feitas em outros dispositivos.
  const companyId = state?.company.id;
  useEffect(() => {
    if (!supabase || !companyId || status !== "pronto") return;
    return subscribeCompany(supabase, companyId, (e: RemoteEvent) => {
      if (e.type === "upsert") dispatch({ type: "upsert", collection: e.collection, items: [e.item] });
      else if (e.type === "remove") dispatch({ type: "remove", collection: e.collection, ids: [e.id] });
      else dispatch({ type: "addMessage", conversationId: e.conversationId, message: e.message });
    });
  }, [supabase, companyId, status]);

  // Persistência local do modo demonstração.
  useEffect(() => {
    if (mode !== "demo" || status !== "pronto" || !state) return;
    if (fromOtherTab.current) {
      fromOtherTab.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Sem persistência: a demonstração continua funcionando em memória.
    }
  }, [mode, status, state]);

  const refresh = useCallback(async () => {
    if (supabase) await loadFromSupabase(stateRef.current?.company.id);
  }, [supabase, loadFromSupabase]);

  const commit = useCallback(
    async (action: Action, mutation: Mutation): Promise<boolean> => {
      dispatch(action);
      if (!supabase || !stateRef.current) return true;
      try {
        await persist(supabase, stateRef.current.company.id, mutation);
        return true;
      } catch (e) {
        toast(`Não foi possível salvar: ${errorMessage(e)}`, "erro");
        await refresh().catch(() => undefined);
        return false;
      }
    },
    [supabase, toast, refresh],
  );

  const db: Db = useMemo(
    () => ({
      upsert: (collection, items) =>
        commit(
          { type: "upsert", collection, items: items as unknown as AnyItem[] },
          { kind: "upsert", collection, items: items as never },
        ),
      patch: (collection, id, patch) => {
        const current = (stateRef.current?.[collection] as unknown as AnyItem[] | undefined)?.find((x) => x.id === id);
        return commit(
          { type: "patch", collection, id, patch: patch as Record<string, unknown> },
          { kind: "patch", collection, id, patch: patch as Record<string, unknown>, after: current ? { ...current, ...patch } : undefined },
        );
      },
      remove: (collection, ids) => commit({ type: "remove", collection, ids }, { kind: "remove", collection, ids }),
      addMessage: (conversationId, message) =>
        commit({ type: "addMessage", conversationId, message }, { kind: "message", conversationId, message }),
      patchCompany: (patch) => commit({ type: "patchCompany", patch }, { kind: "company", patch }),
      readNotifications: () =>
        commit(
          { type: "readNotifications" },
          { kind: "readNotifications", ids: stateRef.current?.notifications.filter((n) => !n.read).map((n) => n.id) ?? [] },
        ),
    }),
    [commit],
  );

  const reset = useCallback(() => {
    if (!supabase) dispatch({ type: "replace", state: freshDemoState() });
  }, [supabase]);

  const switchCompany = useCallback(
    (id: string) => {
      setStatus("carregando");
      loadFromSupabase(id).catch((e) => {
        setLoadError(errorMessage(e));
        setStatus("erro");
      });
    },
    [loadFromSupabase],
  );

  const value = useMemo(
    () => ({ state, mode, supabase, memberships, db, dispatch, reset, refresh, switchCompany, toasts, toast, dismissToast }),
    [state, mode, supabase, memberships, db, reset, refresh, switchCompany, toasts, toast, dismissToast],
  );

  if (status === "erro") {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center" role="alert">
        <div>
          <p className="font-display text-xl font-semibold">Não foi possível carregar seus dados</p>
          <p className="mt-1 text-sm text-muted">{loadError}</p>
          <button className="mt-4 min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-fg" onClick={() => window.location.reload()}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }
  if (status !== "pronto" || !state) {
    return (
      <div className="grid min-h-dvh place-items-center text-muted" role="status">
        Carregando o Balcão…
      </div>
    );
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore precisa estar dentro de <StoreProvider>");
  return ctx;
}

/** Identificadores UUID, aceitos tanto pelo banco quanto pela demonstração. */
export function newId(_prefix?: string): string {
  return crypto.randomUUID();
}

/** Atalhos de leitura usados em várias telas. */
export function useLookups() {
  const { state } = useStore();
  return useMemo(() => {
    const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
    const currentUser = state.users.find((u) => u.id === state.currentUserId) ?? state.users[0] ?? {
      id: state.currentUserId,
      name: "Usuário",
      role: "admin" as const,
    };
    return {
      professionals: byId(state.professionals),
      services: byId(state.services),
      customers: byId(state.customers),
      users: byId(state.users),
      currentUser,
    };
  }, [state.professionals, state.services, state.customers, state.users, state.currentUserId]);
}

/** Profissionais ativos da unidade selecionada. */
export function useActiveProfessionals() {
  const { state } = useStore();
  return useMemo(
    () =>
      state.professionals.filter(
        (p) => p.active && (!state.currentUnitId || !p.unitId || p.unitId === state.currentUnitId),
      ),
    [state.professionals, state.currentUnitId],
  );
}

/** Relógio que atualiza a cada intervalo, para tempos de espera e a linha da hora atual. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
