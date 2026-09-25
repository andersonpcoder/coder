"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import {
  ArrowLeft,
  CalendarPlus,
  CheckCheck,
  Info,
  RotateCcw,
  Search,
  SendHorizontal,
  Tag,
  UserRoundCog,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FeatureGate } from "@/components/shell/upgrade-notice";
import { AppointmentDialog, type AppointmentDialogSeed } from "@/components/agenda/appointment-dialog";
import { ChannelIcon, StatusBadge } from "@/components/shared/status";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { isSameDay } from "@/lib/dates";
import { channelLabel, firstName, formatDate, formatDayShort, formatPhone, formatTime, money } from "@/lib/format";
import { fromRow } from "@/lib/db/mappers";
import { nextAvailableSlots } from "@/lib/scheduling";
import { newId, useLookups, useStore } from "@/lib/store";
import type { Conversation, ConversationChannel } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "abertos" | "meus" | "resolvidos";

export default function AtendimentosPage() {
  return (
    <FeatureGate feature="atendimentos">
      <AtendimentosPageContent />
    </FeatureGate>
  );
}

function AtendimentosPageContent() {
  const { state, db } = useStore();
  const { customers, currentUser } = useLookups();
  const [tab, setTab] = useState<Tab>("abertos");
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState<ConversationChannel | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const lastAt = (c: Conversation) => c.lastMessageAt;
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.conversations
      .filter((c) =>
        tab === "resolvidos" ? c.status === "resolvida" : c.status === "aberta" && (tab === "abertos" || c.assignedTo === currentUser.id),
      )
      .filter((c) => !channel || c.channel === channel)
      .filter((c) => !q || customers.get(c.customerId)?.name.toLowerCase().includes(q))
      .sort((a, b) => lastAt(b).localeCompare(lastAt(a)));
  }, [state.conversations, tab, channel, query, customers, currentUser.id]);

  const counts = {
    abertos: state.conversations.filter((c) => c.status === "aberta").length,
    meus: state.conversations.filter((c) => c.status === "aberta" && c.assignedTo === currentUser.id).length,
  };

  const selected = state.conversations.find((c) => c.id === selectedId) ?? null;

  const open = (c: Conversation) => {
    setSelectedId(c.id);
    if (c.unread) void db.patch("conversations", c.id, { unread: 0 });
  };

  return (
    <div className="-mx-4 -my-5 flex h-[calc(100dvh-4rem)] sm:-mx-6 lg:-mx-8">
      {/* Lista de conversas */}
      <section
        aria-label="Conversas"
        className={cn(
          "flex w-full flex-col border-r border-border bg-surface md:w-[340px] md:shrink-0",
          selected && "hidden md:flex",
        )}
      >
        <div className="flex flex-col gap-3 border-b border-border p-4">
          <h1 className="text-2xl font-semibold">Atendimentos</h1>
          <Segmented
            label="Filtrar conversas"
            value={tab}
            onChange={setTab}
            className="w-full [&>button]:flex-1 [&>button]:justify-center"
            options={[
              { value: "abertos", label: "Abertos", badge: counts.abertos },
              { value: "meus", label: "Meus", badge: counts.meus },
              { value: "resolvidos", label: "Resolvidos" },
            ]}
          />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input aria-label="Buscar conversa" placeholder="Buscar cliente" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select
              aria-label="Canal"
              value={channel}
              onChange={(e) => setChannel(e.target.value as ConversationChannel | "")}
              className="min-h-11 rounded-xl border border-border bg-surface px-2 text-sm"
            >
              <option value="">Todos</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="instagram">Instagram</option>
              <option value="site">Site</option>
            </select>
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {list.length === 0 && <li className="p-6 text-center text-sm text-muted">Nenhuma conversa aqui.</li>}
          {list.map((c) => {
            const customer = customers.get(c.customerId);
            const last = c.messages[c.messages.length - 1];
            const active = c.id === selectedId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => open(c)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full gap-3 border-b border-border/70 px-4 py-3 text-left hover:bg-surface-2",
                    active && "bg-primary-soft/60 hover:bg-primary-soft/60",
                  )}
                >
                  <span className="relative">
                    <Avatar name={customer?.name ?? "?"} />
                    <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-surface">
                      <ChannelIcon channel={c.channel} className="size-3.5" />
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={cn("truncate text-sm", c.unread ? "font-bold" : "font-semibold")}>{customer?.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted">{last && relativeTime(last.at)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={cn("truncate text-[13px]", c.unread ? "text-text" : "text-muted")}>
                        {last?.direction === "saida" && "Você: "}
                        {last?.body}
                      </span>
                      {c.unread > 0 && (
                        <span className="ml-auto shrink-0 rounded-full bg-accent px-1.5 text-[11px] leading-5 font-semibold text-white" aria-label={`${c.unread} não lidas`}>
                          {c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Conversa */}
      {selected ? (
        <ChatPane key={selected.id} conversation={selected} onBack={() => setSelectedId(null)} onToggleInfo={() => setPanelOpen((v) => !v)} />
      ) : (
        <div className="hidden flex-1 place-items-center p-8 text-center text-muted md:grid">
          <div>
            <p className="font-display text-xl font-semibold text-text">Selecione uma conversa</p>
            <p className="mt-1 text-sm">WhatsApp, Instagram e o chat do site chegam todos aqui.</p>
          </div>
        </div>
      )}

      {/* Painel do cliente */}
      {selected && (
        <aside
          aria-label="Dados do cliente"
          className={cn(
            "w-[320px] shrink-0 overflow-y-auto border-l border-border bg-surface",
            panelOpen ? "fixed inset-y-0 right-0 z-40 block w-[min(340px,92vw)] shadow-2xl xl:static xl:shadow-none" : "hidden xl:block",
          )}
        >
          <CustomerPanel conversation={selected} onClose={() => setPanelOpen(false)} />
        </aside>
      )}
    </div>
  );
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 60_000;
  if (diff < 1) return "agora";
  if (diff < 60) return `${Math.floor(diff)} min`;
  if (isSameDay(d, new Date())) return formatTime(d);
  return formatDate(d).slice(0, 5);
}

function ChatPane({
  conversation: c,
  onBack,
  onToggleInfo,
}: {
  conversation: Conversation;
  onBack: () => void;
  onToggleInfo: () => void;
}) {
  const { state, db, toast, supabase, dispatch } = useStore();
  const { customers, users, currentUser, professionals, services } = useLookups();
  const [text, setText] = useState("");
  const [schedule, setSchedule] = useState<AppointmentDialogSeed | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const customer = customers.get(c.customerId);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [c.messages.length]);

  // Conversas antigas não vêm na carga inicial; busca o histórico ao abrir.
  useEffect(() => {
    if (!supabase || c.messages.length) return;
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", c.id)
      .order("created_at")
      .then(({ data }) => {
        if (data?.length) {
          dispatch({ type: "upsert", collection: "conversations", items: [{ id: c.id, messages: data.map(fromRow.message) }] });
        }
      });
  }, [supabase, c.id, c.messages.length, dispatch]);

  const customerAppointments = state.appointments
    .filter((a) => a.customerId === c.customerId)
    .sort((a, b) => a.start.localeCompare(b.start));
  const next = customerAppointments.find((a) => new Date(a.start) > new Date() && (a.status === "agendado" || a.status === "confirmado"));
  const last = [...customerAppointments].reverse().find((a) => new Date(a.start) <= new Date());

  const send = (body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    void db.addMessage(c.id, { id: newId(), direction: "saida", body: trimmed, at: new Date().toISOString(), authorId: currentUser.id });
    if (!c.assignedTo) void db.patch("conversations", c.id, { assignedTo: currentUser.id });
    setText("");
  };

  const insert = (body: string) => {
    setText(body);
    inputRef.current?.focus();
  };

  // Respostas rápidas com variáveis: {nome}, {servico}, {profissional},
  // {horarios}, {data}, {hora}, {endereco} e {empresa}.
  const runQuickReply = (title: string, body: string) => {
    const ref = next ?? last;
    const pro = state.professionals.find((p) => p.id === ref?.professionalId && p.active) ?? state.professionals.find((p) => p.active);
    const svc = services.get(ref?.serviceId ?? pro?.serviceIds[0] ?? "");
    const vars: Record<string, string> = {
      nome: firstName(customer?.name ?? ""),
      servico: svc?.name ?? "",
      profissional: firstName(pro?.name ?? ""),
      endereco: state.company.address,
      empresa: state.company.name,
    };
    if (body.includes("{horarios}")) {
      const slots = pro && svc ? nextAvailableSlots(pro, svc.durationMin, state.appointments, state.blocks, 4) : [];
      if (!slots.length) {
        toast("Sem horários livres nos próximos 14 dias.", "erro");
        return;
      }
      vars.horarios = slots.map((s) => `• ${formatDayShort(s)} às ${formatTime(s)}`).join("\n");
    }
    if (body.includes("{data}") || body.includes("{hora}")) {
      if (!next) {
        toast("Este cliente não tem agendamento futuro.", "erro");
        return;
      }
      vars.data = formatDayShort(next.start);
      vars.hora = formatTime(next.start);
      vars.servico = services.get(next.serviceId)?.name ?? vars.servico;
      vars.profissional = firstName(professionals.get(next.professionalId)?.name ?? "");
      if (/confirm/i.test(title) && next.status === "agendado") {
        void db.patch("appointments", next.id, { status: "confirmado" });
        toast("Agendamento marcado como confirmado.", "sucesso");
      }
    }
    insert(body.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`));
  };

  const assignee = c.assignedTo ? users.get(c.assignedTo) : undefined;

  return (
    <section aria-label={`Conversa com ${customer?.name}`} className="flex min-w-0 flex-1 flex-col bg-bg">
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2 sm:px-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label="Voltar para a lista">
          <ArrowLeft />
        </Button>
        <Avatar name={customer?.name ?? "?"} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{customer?.name}</div>
          <div className="flex items-center gap-1 text-xs text-muted">
            <ChannelIcon channel={c.channel} className="size-3.5" /> {channelLabel[c.channel]}
            {assignee && <> · com {firstName(assignee.name)}</>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="soft" size="sm" onClick={() => setSchedule({ customerId: c.customerId, channel: c.channel, start: nextQuarterHour() })}>
            <CalendarPlus /> <span className="hidden sm:inline">Agendar</span>
          </Button>
          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <Button variant="ghost" size="icon" aria-label="Transferir conversa">
                <UserRoundCog />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content align="end" sideOffset={6} className="z-50 w-60 rounded-2xl border border-border bg-surface p-1.5 shadow-xl">
                <Dropdown.Label className="px-3 py-2 text-xs font-semibold text-muted">Transferir para</Dropdown.Label>
                {state.users.filter((u) => u.role !== "profissional").map((u) => (
                  <Dropdown.Item
                    key={u.id}
                    disabled={u.id === c.assignedTo}
                    onSelect={() => {
                      void db.patch("conversations", c.id, { assignedTo: u.id });
                void db.addMessage(c.id, { id: newId(), direction: "sistema", body: `Conversa transferida para ${u.name}`, at: new Date().toISOString() });
                      toast(`Conversa transferida para ${u.name}.`, "sucesso");
                    }}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2"
                  >
                    <Avatar name={u.name} size="sm" /> {u.name}
                  </Dropdown.Item>
                ))}
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>
          {c.status === "aberta" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void db.patch("conversations", c.id, { status: "resolvida", unread: 0 });
                toast("Conversa resolvida.", "sucesso");
              }}
            >
              <CheckCheck /> <span className="hidden sm:inline">Resolver</span>
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => void db.patch("conversations", c.id, { status: "aberta" })}>
              <RotateCcw /> <span className="hidden sm:inline">Reabrir</span>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="xl:hidden" onClick={onToggleInfo} aria-label="Dados do cliente">
            <Info />
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6" role="log" aria-label="Mensagens">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {c.messages.map((m, i) => {
            const prev = c.messages[i - 1];
            const showDay = !prev || !isSameDay(new Date(prev.at), new Date(m.at));
            return (
              <div key={m.id} className="flex flex-col gap-2">
                {showDay && (
                  <span className="mx-auto my-2 rounded-full bg-surface-2 px-3 py-1 text-xs text-muted first-letter:uppercase">
                    {isSameDay(new Date(m.at), new Date()) ? "Hoje" : formatDayShort(m.at)}
                  </span>
                )}
                {m.direction === "sistema" ? (
                  <span className="mx-auto text-center text-xs text-muted">{m.body} · {formatTime(m.at)}</span>
                ) : (
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line sm:max-w-[70%]",
                      m.direction === "saida"
                        ? "self-end rounded-br-md bg-primary text-primary-fg"
                        : "self-start rounded-bl-md border border-border bg-surface",
                    )}
                  >
                    {m.body}
                    <span className={cn("mt-0.5 block text-right text-[11px]", m.direction === "saida" ? "opacity-75" : "text-muted")}>
                      {m.authorId && m.direction === "saida" ? `${firstName(users.get(m.authorId)?.name ?? "")} · ` : ""}
                      {formatTime(m.at)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </div>

      <footer className="border-t border-border bg-surface p-3">
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Respostas rápidas">
          {state.quickReplies.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => runQuickReply(r.title, r.body)}
              className="min-h-10 shrink-0 rounded-full border border-border px-3 text-[13px] font-medium hover:border-primary hover:text-primary"
            >
              {r.title}
            </button>
          ))}
        </div>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            send(text);
          }}
        >
          <Textarea
            ref={inputRef}
            aria-label="Mensagem"
            placeholder={`Responder pelo ${channelLabel[c.channel]}…`}
            title="Enter envia, Shift+Enter quebra linha"
            className="max-h-40 min-h-11 resize-none"
            rows={Math.min(6, Math.max(1, text.split("\n").length))}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
          />
          <Button type="submit" size="icon" aria-label="Enviar" disabled={!text.trim()}>
            <SendHorizontal />
          </Button>
        </form>
      </footer>

      <AppointmentDialog seed={schedule} onClose={() => setSchedule(null)} />
    </section>
  );
}

function nextQuarterHour(): Date {
  const d = new Date();
  d.setMinutes(Math.ceil((d.getMinutes() + 1) / 15) * 15, 0, 0);
  return d;
}

function CustomerPanel({ conversation: c, onClose }: { conversation: Conversation; onClose: () => void }) {
  const { state, db } = useStore();
  const { customers, services, professionals } = useLookups();
  const [newTag, setNewTag] = useState("");
  const customer = customers.get(c.customerId);
  if (!customer) return null;

  const appts = state.appointments
    .filter((a) => a.customerId === customer.id)
    .sort((a, b) => b.start.localeCompare(a.start));
  const now = new Date();
  const next = [...appts].reverse().find((a) => new Date(a.start) > now && a.status !== "cancelado");
  const history = appts.filter((a) => new Date(a.start) <= now).slice(0, 5);
  const visits = appts.filter((a) => a.status === "concluido").length;
  const noShows = appts.filter((a) => a.status === "faltou").length;
  const spent = state.payments.filter((p) => p.customerId === customer.id).reduce((s, p) => s + p.amountCents, 0);

  const tags = c.tags;
  const setTags = (next: string[]) => void db.patch("conversations", c.id, { tags: next });

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-start gap-3">
        <Avatar name={customer.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold">{customer.name}</h2>
          <p className="text-sm text-muted">{formatPhone(customer.phone)}</p>
          {customer.email && <p className="truncate text-sm text-muted">{customer.email}</p>}
        </div>
        <Button variant="ghost" size="icon" className="-mt-2 -mr-2 xl:hidden" onClick={onClose} aria-label="Fechar painel">
          <X />
        </Button>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface-2 p-2">
          <dt className="text-[11px] text-muted">Visitas</dt>
          <dd className="font-display text-lg font-semibold">{visits}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-2">
          <dt className="text-[11px] text-muted">Faltas</dt>
          <dd className={cn("font-display text-lg font-semibold", noShows > 1 && "text-danger")}>{noShows}</dd>
        </div>
        <div className="rounded-xl bg-surface-2 p-2">
          <dt className="text-[11px] text-muted">Gasto</dt>
          <dd className="font-display text-sm leading-7 font-semibold">{money(spent)}</dd>
        </div>
      </dl>

      {customer.notes && (
        <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-text">
          <strong className="font-semibold">Observação:</strong> {customer.notes}
        </p>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold">Próximo agendamento</h3>
        {next ? (
          <div className={cn("svc rounded-xl px-3 py-2 text-sm", `svc-${services.get(next.serviceId)?.color}`)}>
            <div className="font-semibold first-letter:uppercase">{formatDayShort(next.start)} · {formatTime(next.start)}</div>
            <div>{services.get(next.serviceId)?.name} com {professionals.get(next.professionalId)?.name}</div>
            <StatusBadge status={next.status} className="mt-1 bg-surface/70" />
          </div>
        ) : (
          <p className="text-sm text-muted">Nenhum agendamento futuro.</p>
        )}
      </section>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Tag className="size-4" /> Etiquetas</h3>
        <div className="flex flex-wrap gap-1.5">
          {[...new Set([...customer.tags, ...tags])].map((t) => (
            <Badge key={t} tone={customer.tags.includes(t) ? "primary" : "accent"}>
              {t}
              {tags.includes(t) && (
                <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remover etiqueta ${t}`} className="-mr-1 ml-0.5">
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = newTag.trim();
            if (t && !tags.includes(t)) setTags([...tags, t]);
            setNewTag("");
          }}
        >
          <Input aria-label="Nova etiqueta" placeholder="Nova etiqueta" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
          <Button type="submit" variant="outline">Adicionar</Button>
        </form>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold">Histórico</h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted">Primeira visita.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{services.get(a.serviceId)?.name}</span>
                  <span className="block text-xs text-muted">{formatDate(a.start)} · {firstName(professionals.get(a.professionalId)?.name ?? "")}</span>
                </span>
                <StatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted">Cliente desde {formatDate(customer.createdAt)}</p>
    </div>
  );
}
