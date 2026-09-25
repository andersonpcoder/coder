"use client";

import { useCallback } from "react";
import { addMinutes } from "./dates";
import { formatDate, formatTime, money, paymentMethodLabel, statusLabel } from "./format";
import { findConflict, isWithinWorkHours, recurrenceDates, type Conflict } from "./scheduling";
import { newId, useStore } from "./store";
import type {
  Appointment,
  AppointmentStatus,
  BookingChannel,
  Customer,
  PaymentMethod,
  QueueEntry,
  Recurrence,
} from "./types";

export interface AppointmentDraft {
  id?: string;
  customerId?: string;
  newCustomer?: { name: string; phone: string };
  serviceId: string;
  professionalId: string;
  start: Date;
  durationMin: number;
  status: AppointmentStatus;
  channel: BookingChannel;
  notes?: string;
  recurrence: Recurrence;
  occurrences: number;
}

export function describeConflict(c: Conflict, customers: Map<string, Customer>): string {
  if (c.kind === "bloqueio") return `horário bloqueado (${c.block.reason ?? "bloqueio"})`;
  const who = customers.get(c.appointment.customerId)?.name ?? "outro cliente";
  return `já existe ${who} às ${formatTime(c.appointment.start)}`;
}

/** Operações de agenda, fila e caixa com as mesmas validações do banco. */
export function useActions() {
  const { state, db, dispatch, toast } = useStore();

  const customersMap = useCallback(() => new Map(state.customers.map((c) => [c.id, c])), [state.customers]);

  const saveAppointment = useCallback(
    async (draft: AppointmentDraft): Promise<boolean> => {
      const service = state.services.find((s) => s.id === draft.serviceId);
      const pro = state.professionals.find((p) => p.id === draft.professionalId);
      if (!service || !pro) {
        toast("Escolha o serviço e o profissional.", "erro");
        return false;
      }
      let customerId = draft.customerId;
      if (!customerId && draft.newCustomer?.name.trim()) {
        customerId = newId();
        const ok = await db.upsert("customers", [
          {
            id: customerId,
            name: draft.newCustomer.name.trim(),
            phone: draft.newCustomer.phone.replace(/\D/g, ""),
            tags: ["Novo"],
            createdAt: new Date().toISOString(),
          },
        ]);
        if (!ok) return false;
      }
      if (!customerId) {
        toast("Informe o cliente.", "erro");
        return false;
      }

      if (draft.id) {
        const start = draft.start;
        const end = addMinutes(start, draft.durationMin);
        const occupying = draft.status !== "cancelado" && draft.status !== "faltou";
        const conflict = occupying && findConflict(pro.id, start, end, state.appointments, state.blocks, draft.id);
        if (conflict) {
          toast(`Conflito de horário: ${describeConflict(conflict, customersMap())}.`, "erro");
          return false;
        }
        const ok = await db.patch("appointments", draft.id, {
            customerId,
            serviceId: service.id,
            professionalId: pro.id,
            start: start.toISOString(),
            end: end.toISOString(),
            status: draft.status,
            channel: draft.channel,
            notes: draft.notes ?? undefined,
        });
        if (ok) toast("Agendamento atualizado.", "sucesso");
        return ok;
      }

      const dates = recurrenceDates(draft.start, draft.recurrence, draft.occurrences);
      const recurrenceId = dates.length > 1 ? newId() : undefined;
      const created: Appointment[] = [];
      const skipped: Date[] = [];
      for (const start of dates) {
        const end = addMinutes(start, draft.durationMin);
        if (findConflict(pro.id, start, end, [...state.appointments, ...created], state.blocks)) {
          skipped.push(start);
          continue;
        }
        created.push({
          id: newId(),
          customerId,
          serviceId: service.id,
          professionalId: pro.id,
          start: start.toISOString(),
          end: end.toISOString(),
          status: draft.status,
          channel: draft.channel,
          priceCents: service.priceCents,
          notes: draft.notes,
          recurrenceId,
          unitId: pro.unitId ?? state.units[0]?.id,
        });
      }
      if (!created.length) {
        const conflict = findConflict(pro.id, draft.start, addMinutes(draft.start, draft.durationMin), state.appointments, state.blocks);
        toast(`Conflito de horário: ${conflict ? describeConflict(conflict, customersMap()) : "horário indisponível"}.`, "erro");
        return false;
      }
      if (!(await db.upsert("appointments", created))) return false;
      if (!isWithinWorkHours(pro, draft.start, addMinutes(draft.start, draft.durationMin))) {
        toast(`Atenção: fora do horário de trabalho de ${pro.name}.`);
      }
      toast(
        created.length > 1
          ? `${created.length} agendamentos criados${skipped.length ? `; ${skipped.length} datas puladas por conflito (${skipped.map(formatDate).join(", ")})` : ""}.`
          : "Agendamento criado. O cliente receberá os lembretes automáticos.",
        "sucesso",
      );
      return true;
    },
    [state.services, state.professionals, state.appointments, state.blocks, state.units, db, toast, customersMap],
  );

  /** Arrastar e redimensionar: move mantendo as regras de conflito. */
  const moveAppointment = useCallback(
    async (id: string, start: Date, end: Date, professionalId: string): Promise<boolean> => {
      const appt = state.appointments.find((a) => a.id === id);
      if (!appt) return false;
      const pro = state.professionals.find((p) => p.id === professionalId);
      if (pro && !pro.serviceIds.includes(appt.serviceId)) {
        toast(`${pro.name} não faz este serviço.`, "erro");
        return false;
      }
      const conflict = findConflict(professionalId, start, end, state.appointments, state.blocks, id);
      if (conflict) {
        toast(`Não foi possível mover: ${describeConflict(conflict, customersMap())}.`, "erro");
        return false;
      }
      const ok = await db.patch("appointments", id, { start: start.toISOString(), end: end.toISOString(), professionalId });
      if (ok) toast(`Movido para ${formatDate(start)} às ${formatTime(start)}.`, "sucesso");
      return ok;
    },
    [state.appointments, state.professionals, state.blocks, db, toast, customersMap],
  );

  const setStatus = useCallback(
    async (id: string, status: AppointmentStatus) => {
      if (await db.patch("appointments", id, { status })) toast(`Status alterado para ${statusLabel[status]}.`, "sucesso");
    },
    [db, toast],
  );

  const registerPayment = useCallback(
    async (input: { appointmentId?: string; customerId?: string; professionalId?: string; method: PaymentMethod; amountCents: number }) => {
      const pro = state.professionals.find((p) => p.id === input.professionalId);
      const ok = await db.upsert("payments", [
        {
          id: newId(),
          paidAt: new Date().toISOString(),
          commissionCents: pro ? Math.round((input.amountCents * pro.commissionPct) / 100) : 0,
          ...input,
        },
      ]);
      if (ok) toast(`Pagamento de ${money(input.amountCents)} registrado (${paymentMethodLabel[input.method]}).`, "sucesso");
    },
    [db, toast, state.professionals],
  );

  const nextTicket = useCallback(
    (walkIn: boolean) => {
      const prefix = walkIn ? "E" : "A";
      const today = new Date().toDateString();
      const count = state.queue.filter((q) => q.ticket.startsWith(prefix) && new Date(q.checkedInAt).toDateString() === today).length;
      return `${prefix}${String(count + 1).padStart(3, "0")}`;
    },
    [state.queue],
  );

  const checkIn = useCallback(
    async (appointment: Appointment) => {
      const customer = state.customers.find((c) => c.id === appointment.customerId);
      const entry: QueueEntry = {
        id: newId(),
        ticket: nextTicket(false),
        unitId: appointment.unitId,
        customerName: customer?.name ?? "Cliente",
        customerId: appointment.customerId,
        appointmentId: appointment.id,
        serviceId: appointment.serviceId,
        professionalId: appointment.professionalId,
        isWalkIn: false,
        status: "aguardando",
        checkedInAt: new Date().toISOString(),
      };
      if (!(await db.upsert("queue", [entry]))) return;
      await db.patch("appointments", appointment.id, { status: "aguardando" });
      toast(`Check-in de ${entry.customerName} feito. Senha ${entry.ticket}.`, "sucesso");
    },
    [state.customers, nextTicket, db, toast],
  );

  const addWalkIn = useCallback(
    async (input: { name: string; serviceId?: string; professionalId?: string }) => {
      const entry: QueueEntry = {
        id: newId(),
        unitId: state.currentUnitId ?? state.units[0]?.id,
        ticket: nextTicket(true),
        customerName: input.name.trim(),
        serviceId: input.serviceId,
        professionalId: input.professionalId,
        isWalkIn: true,
        status: "aguardando",
        checkedInAt: new Date().toISOString(),
      };
      if (await db.upsert("queue", [entry])) toast(`Encaixe de ${entry.customerName} na fila. Senha ${entry.ticket}.`, "sucesso");
    },
    [nextTicket, db, toast, state.currentUnitId, state.units],
  );

  const updateQueue = useCallback(
    async (entry: QueueEntry, status: QueueEntry["status"], professionalId?: string) => {
      const now = new Date().toISOString();
      const patch: Partial<QueueEntry> = { status };
      if (professionalId) patch.professionalId = professionalId;
      if (status === "chamado") patch.calledAt = now;
      if (status === "em_atendimento") patch.startedAt = now;
      if (status === "concluido" || status === "desistiu") patch.finishedAt = now;
      if (status === "chamado") dispatch({ type: "setLastCall", id: entry.id });
      if (!(await db.patch("queue", entry.id, patch))) return;
      if (entry.appointmentId) {
        const apptStatus: Partial<Record<QueueEntry["status"], AppointmentStatus>> = {
          em_atendimento: "em_atendimento",
          concluido: "concluido",
          desistiu: "faltou",
        };
        const next = apptStatus[status];
        if (next) await db.patch("appointments", entry.appointmentId, { status: next });
      }
    },
    [db, dispatch],
  );

  return { saveAppointment, moveAppointment, setStatus, registerPayment, checkIn, addWalkIn, updateQueue };
}
