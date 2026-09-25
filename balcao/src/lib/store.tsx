"use client";

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
import { buildDataset, type Dataset } from "./mock-data";
import type {
  Appointment,
  Conversation,
  Customer,
  Message,
  Payment,
  QueueEntry,
  TimeBlock,
} from "./types";

// Estado da demonstração. Em produção cada ação vira uma chamada ao Supabase
// (ver lib/supabase) e o tempo real substitui a sincronização entre abas.

const STORAGE_KEY = "balcao:demo:v1";

export interface State extends Dataset {
  generatedFor: string;
  currentUserId: string;
  /** Última senha chamada, exibida no painel de TV. */
  lastCallId?: string;
}

type Action =
  | { type: "replace"; state: State }
  | { type: "setUser"; userId: string }
  | { type: "addAppointments"; appointments: Appointment[] }
  | { type: "updateAppointment"; id: string; patch: Partial<Appointment> }
  | { type: "addBlock"; block: TimeBlock }
  | { type: "removeBlock"; id: string }
  | { type: "addCustomer"; customer: Customer }
  | { type: "addQueueEntry"; entry: QueueEntry }
  | { type: "updateQueueEntry"; id: string; patch: Partial<QueueEntry>; call?: boolean }
  | { type: "addMessage"; conversationId: string; message: Message }
  | { type: "updateConversation"; id: string; patch: Partial<Conversation> }
  | { type: "addPayment"; payment: Payment }
  | { type: "readNotifications" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "replace":
      return action.state;
    case "setUser":
      return { ...state, currentUserId: action.userId };
    case "addAppointments":
      return { ...state, appointments: [...state.appointments, ...action.appointments] };
    case "updateAppointment":
      return {
        ...state,
        appointments: state.appointments.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a)),
      };
    case "addBlock":
      return { ...state, blocks: [...state.blocks, action.block] };
    case "removeBlock":
      return { ...state, blocks: state.blocks.filter((b) => b.id !== action.id) };
    case "addCustomer":
      return { ...state, customers: [...state.customers, action.customer] };
    case "addQueueEntry":
      return { ...state, queue: [...state.queue, action.entry] };
    case "updateQueueEntry":
      return {
        ...state,
        queue: state.queue.map((q) => (q.id === action.id ? { ...q, ...action.patch } : q)),
        lastCallId: action.call ? action.id : state.lastCallId,
      };
    case "addMessage":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId ? { ...c, messages: [...c.messages, action.message] } : c,
        ),
      };
    case "updateConversation":
      return {
        ...state,
        conversations: state.conversations.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
      };
    case "addPayment":
      return { ...state, payments: [...state.payments, action.payment] };
    case "readNotifications":
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };
  }
}

function freshState(): State {
  return { ...buildDataset(), generatedFor: toDateInput(new Date()), currentUserId: "u-ana" };
}

function loadState(): State {
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
  return freshState();
}

export interface Toast {
  id: number;
  message: string;
  tone: "info" | "sucesso" | "erro";
}

interface StoreValue {
  state: State;
  dispatch: (action: Action) => void;
  reset: () => void;
  toasts: Toast[];
  toast: (message: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: number) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => null as unknown as State);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const fromOtherTab = useRef(false);

  useEffect(() => {
    dispatch({ type: "replace", state: loadState() });
    setReady(true);
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
  }, []);

  useEffect(() => {
    if (!ready || !state) return;
    if (fromOtherTab.current) {
      fromOtherTab.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Sem persistência: a demonstração continua funcionando em memória.
    }
  }, [ready, state]);

  const toast = useCallback((message: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const reset = useCallback(() => dispatch({ type: "replace", state: freshState() }), []);

  const value = useMemo(
    () => ({ state, dispatch, reset, toasts, toast, dismissToast }),
    [state, reset, toasts, toast, dismissToast],
  );

  if (!ready || !state) {
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

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Atalhos de leitura usados em várias telas. */
export function useLookups() {
  const { state } = useStore();
  return useMemo(() => {
    const byId = <T extends { id: string }>(list: T[]) => new Map(list.map((x) => [x.id, x]));
    const currentUser = state.users.find((u) => u.id === state.currentUserId) ?? state.users[0];
    return {
      professionals: byId(state.professionals),
      services: byId(state.services),
      customers: byId(state.customers),
      users: byId(state.users),
      currentUser,
    };
  }, [state.professionals, state.services, state.customers, state.users, state.currentUserId]);
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
