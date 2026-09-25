"use client";

import { CheckCircle2, Repeat, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/shared/status";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useActions, type AppointmentDraft } from "@/lib/actions";
import { atMinutes, fromDateInput, parseTimeInput, toDateInput, toTimeInput } from "@/lib/dates";
import { channelLabel, formatDuration, formatPhone, money, statusLabel } from "@/lib/format";
import { availableSlots } from "@/lib/scheduling";
import { useStore } from "@/lib/store";
import type { Appointment, AppointmentStatus, BookingChannel, Recurrence } from "@/lib/types";

export interface AppointmentDialogSeed {
  appointment?: Appointment;
  start?: Date;
  professionalId?: string;
  customerId?: string;
  channel?: BookingChannel;
}

const recurrenceLabel: Record<Recurrence, string> = {
  nenhuma: "Não repetir",
  semanal: "Toda semana",
  quinzenal: "A cada 15 dias",
  mensal: "Todo mês",
};

export function AppointmentDialog({
  seed,
  onClose,
  onConclude,
}: {
  seed: AppointmentDialogSeed | null;
  onClose: () => void;
  /** Chamado ao concluir, para abrir o registro de pagamento. */
  onConclude?: (appointment: Appointment) => void;
}) {
  const { state } = useStore();
  const { saveAppointment } = useActions();
  const editing = seed?.appointment;

  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "" });
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [customerQuery, setCustomerQuery] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [status, setStatus] = useState<AppointmentStatus>("agendado");
  const [channel, setChannel] = useState<BookingChannel>("presencial");
  const [notes, setNotes] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("nenhuma");
  const [occurrences, setOccurrences] = useState(4);

  useEffect(() => {
    if (!seed) return;
    const a = seed.appointment;
    const start = a ? new Date(a.start) : (seed.start ?? new Date());
    const pro = a?.professionalId ?? seed.professionalId ?? "";
    const firstService = state.professionals.find((p) => p.id === pro)?.serviceIds[0] ?? state.services[0].id;
    const svc = a?.serviceId ?? firstService;
    setCustomerId(a?.customerId ?? seed.customerId ?? "");
    setCreatingCustomer(false);
    setNewCustomer({ name: "", phone: "" });
    setCustomerQuery("");
    setServiceId(svc);
    setProfessionalId(pro || (state.professionals.find((p) => p.serviceIds.includes(svc))?.id ?? ""));
    setDate(toDateInput(start));
    setTime(toTimeInput(start));
    setDuration(a ? (new Date(a.end).getTime() - start.getTime()) / 60_000 : (state.services.find((s) => s.id === svc)?.durationMin ?? 30));
    setStatus(a?.status ?? "agendado");
    setChannel(a?.channel ?? seed.channel ?? "presencial");
    setNotes(a?.notes ?? "");
    setRecurrence("nenhuma");
    setOccurrences(4);
  }, [seed, state.professionals, state.services]);

  const service = state.services.find((s) => s.id === serviceId);
  const eligiblePros = state.professionals.filter((p) => p.serviceIds.includes(serviceId));
  const pro = state.professionals.find((p) => p.id === professionalId);

  const suggestions = useMemo(() => {
    if (!pro || !date || !service) return [];
    return availableSlots(
      pro,
      fromDateInput(date),
      duration,
      state.appointments.filter((a) => a.id !== editing?.id),
      state.blocks,
    ).slice(0, 8);
  }, [pro, date, service, duration, state.appointments, state.blocks, editing?.id]);

  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    const digits = q.replace(/\D/g, "");
    return state.customers
      .filter((c) => !q || c.name.toLowerCase().includes(q) || (digits && c.phone.includes(digits)))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [customerQuery, state.customers]);

  const submit = () => {
    if (!date || !time) return;
    const draft: AppointmentDraft = {
      id: editing?.id,
      customerId: creatingCustomer ? undefined : customerId,
      newCustomer: creatingCustomer ? newCustomer : undefined,
      serviceId,
      professionalId,
      start: atMinutes(fromDateInput(date), parseTimeInput(time)),
      durationMin: duration,
      status,
      channel,
      notes: notes.trim() || undefined,
      recurrence,
      occurrences,
    };
    if (saveAppointment(draft)) onClose();
  };

  const customer = state.customers.find((c) => c.id === customerId);

  return (
    <Dialog
      open={!!seed}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? "Editar agendamento" : "Novo agendamento"}
      description={editing && customer ? `${customer.name} · ${formatPhone(customer.phone)}` : undefined}
      className="sm:max-w-2xl"
      footer={
        <>
          {editing && onConclude && !["concluido", "cancelado", "faltou"].includes(editing.status) && (
            <Button variant="soft" className="mr-auto" onClick={() => onConclude(editing)}>
              <CheckCircle2 /> Concluir e receber
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!professionalId || !serviceId || (creatingCustomer ? !newCustomer.name.trim() : !customerId)}>
            {editing ? "Salvar alterações" : "Agendar"}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="sm:col-span-2">
          {creatingCustomer ? (
            <div className="grid gap-3 rounded-2xl bg-surface-2 p-3 sm:grid-cols-2">
              <Field label="Nome do cliente">
                {(id) => (
                  <Input id={id} autoFocus value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
                )}
              </Field>
              <Field label="WhatsApp">
                {(id) => (
                  <Input id={id} inputMode="tel" placeholder="(11) 90000-0000" value={newCustomer.phone} onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })} />
                )}
              </Field>
              <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => setCreatingCustomer(false)}>
                Escolher cliente cadastrado
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
              <Field label="Buscar cliente">
                {(id) => (
                  <Input id={id} placeholder="Nome ou telefone" value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} />
                )}
              </Field>
              <Field label="Cliente">
                {(id) => (
                  <Select id={id} value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
                    <option value="">Selecione…</option>
                    {filteredCustomers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {formatPhone(c.phone)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Button variant="outline" onClick={() => setCreatingCustomer(true)}>
                <UserPlus /> Novo
              </Button>
            </div>
          )}
        </div>

        <Field label="Serviço">
          {(id) => (
            <Select
              id={id}
              value={serviceId}
              onChange={(e) => {
                const svc = state.services.find((s) => s.id === e.target.value);
                setServiceId(e.target.value);
                if (svc) setDuration(svc.durationMin);
                if (svc && !state.professionals.find((p) => p.id === professionalId)?.serviceIds.includes(svc.id)) {
                  setProfessionalId(state.professionals.find((p) => p.serviceIds.includes(svc.id))?.id ?? "");
                }
              }}
            >
              {state.services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {formatDuration(s.durationMin)} · {money(s.priceCents)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Profissional">
          {(id) => (
            <Select id={id} value={professionalId} onChange={(e) => setProfessionalId(e.target.value)} required>
              <option value="">Selecione…</option>
              {eligiblePros.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <Field label="Data">
            {(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />}
          </Field>
          <Field label="Início">
            {(id) => <Input id={id} type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} required />}
          </Field>
          <Field label="Duração">
            {(id) => (
              <Select id={id} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {[15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240].concat(duration % 15 === 0 && duration <= 240 ? [] : [duration]).map((m) => (
                  <option key={m} value={m}>
                    {formatDuration(m)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {suggestions.length > 0 && (
          <div className="sm:col-span-2">
            <p className="mb-2 text-[13px] font-semibold">Horários livres neste dia</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => {
                const value = toTimeInput(s);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTime(value)}
                    aria-pressed={time === value}
                    className="min-h-10 rounded-xl border border-border px-3 text-sm font-medium hover:border-primary aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary"
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <Field label="Status">
          {(id) => (
            <Select id={id} value={status} onChange={(e) => setStatus(e.target.value as AppointmentStatus)}>
              {(Object.keys(statusLabel) as AppointmentStatus[]).map((s) => (
                <option key={s} value={s}>
                  {statusLabel[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Canal">
          {(id) => (
            <Select id={id} value={channel} onChange={(e) => setChannel(e.target.value as BookingChannel)}>
              {(Object.keys(channelLabel) as BookingChannel[]).map((c) => (
                <option key={c} value={c}>
                  {channelLabel[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {!editing && (
          <div className="grid grid-cols-[1fr_auto] gap-3 sm:col-span-2">
            <Field label="Repetir">
              {(id) => (
                <Select id={id} value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
                  {(Object.keys(recurrenceLabel) as Recurrence[]).map((r) => (
                    <option key={r} value={r}>
                      {recurrenceLabel[r]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {recurrence !== "nenhuma" && (
              <Field label="Vezes">
                {(id) => (
                  <Input id={id} type="number" min={2} max={52} className="w-24" value={occurrences} onChange={(e) => setOccurrences(Math.min(52, Math.max(2, Number(e.target.value) || 2)))} />
                )}
              </Field>
            )}
            {recurrence !== "nenhuma" && (
              <p className="col-span-2 flex items-center gap-1.5 text-xs text-muted">
                <Repeat className="size-3.5" /> Datas com conflito são puladas e informadas ao salvar.
              </p>
            )}
          </div>
        )}

        <Field label="Observações" className="sm:col-span-2">
          {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Preferências, alergias, referências…" />}
        </Field>
        {editing?.recurrenceId && (
          <p className="text-xs text-muted sm:col-span-2">
            Faz parte de uma série recorrente. Alterações valem só para esta data. <StatusBadge status={editing.status} />
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
