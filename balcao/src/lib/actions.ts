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
  const { state, dispatch, toast } = useStore();

  const customersMap = useCallback(() => new Map(state.customers.map((c) => [c.id, c])), [state.customers]);

  const saveAppointment = useCallback(
    (draft: AppointmentDraft): boolean => {
      const service = state.services.find((s) => s.id === draft.serviceId);
      const pro = state.professionals.find((p) => p.id === draft.professionalId);
      if (!service || !pro) {
        toast("Escolha o serviço e o profissional.", "erro");
        return false;
      }
      let customerId = draft.customerId;
      if (!customerId && draft.newCustomer?.name.trim()) {
        customerId = newId("cl");
        dispatch({
          type: "addCustomer",
          customer: {
            id: customerId,
            name: draft.newCustomer.name.trim(),
            phone: draft.newCustomer.phone.replace(/\D/g, ""),
            tags: ["Novo"],
            createdAt: new Date().toISOString(),
          },
        });
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
        dispatch({
          type: "updateAppointment",
          id: draft.id,
          patch: {
            customerId,
            serviceId: service.id,
            professionalId: pro.id,
            start: start.toISOString(),
            end: end.toISOString(),
            status: draft.status,
            channel: draft.channel,
            notes: draft.notes,
          },
        });
        toast("Agendamento atualizado.", "sucesso");
        return true;
      }

      const dates = recurrenceDates(draft.start, draft.recurrence, draft.occurrences);
      const recurrenceId = dates.length > 1 ? newId("rec") : undefined;
      const created: Appointment[] = [];
      const skipped: Date[] = [];
      for (const start of dates) {
        const end = addMinutes(start, draft.durationMin);
        if (findConflict(pro.id, start, end, [...state.appointments, ...created], state.blocks)) {
          skipped.push(start);
          continue;
        }
        created.push({
          id: newId("a"),
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
        });
      }
      if (!created.length) {
        const conflict = findConflict(pro.id, draft.start, addMinutes(draft.start, draft.durationMin), state.appointments, state.blocks);
        toast(`Conflito de horário: ${conflict ? describeConflict(conflict, customersMap()) : "horário indisponível"}.`, "erro");
        return false;
      }
      dispatch({ type: "addAppointments", appointments: created });
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
    [state.services, state.professionals, state.appointments, state.blocks, dispatch, toast, customersMap],
  );

  /** Arrastar e redimensionar: move mantendo as regras de conflito. */
  const moveAppointment = useCallback(
    (id: string, start: Date, end: Date, professionalId: string): boolean => {
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
      dispatch({
        type: "updateAppointment",
        id,
        patch: { start: start.toISOString(), end: end.toISOString(), professionalId },
      });
      toast(`Movido para ${formatDate(start)} às ${formatTime(start)}.`, "sucesso");
      return true;
    },
    [state.appointments, state.professionals, state.blocks, dispatch, toast, customersMap],
  );

  const setStatus = useCallback(
    (id: string, status: AppointmentStatus) => {
      dispatch({ type: "updateAppointment", id, patch: { status } });
      toast(`Status alterado para ${statusLabel[status]}.`, "sucesso");
    },
    [dispatch, toast],
  );

  const registerPayment = useCallback(
    (input: { appointmentId?: string; customerId?: string; professionalId?: string; method: PaymentMethod; amountCents: number }) => {
      dispatch({
        type: "addPayment",
        payment: { id: newId("pg"), paidAt: new Date().toISOString(), ...input },
      });
      toast(`Pagamento de ${money(input.amountCents)} registrado (${paymentMethodLabel[input.method]}).`, "sucesso");
    },
    [dispatch, toast],
  );

  const nextTicket = useCallback(
    (walkIn: boolean) => {
      const prefix = walkIn ? "E" : "A";
      const count = state.queue.filter((q) => q.ticket.startsWith(prefix)).length;
      return `${prefix}${String(count + 1).padStart(3, "0")}`;
    },
    [state.queue],
  );

  const checkIn = useCallback(
    (appointment: Appointment) => {
      const customer = state.customers.find((c) => c.id === appointment.customerId);
      const entry: QueueEntry = {
        id: newId("q"),
        ticket: nextTicket(false),
        customerName: customer?.name ?? "Cliente",
        customerId: appointment.customerId,
        appointmentId: appointment.id,
        serviceId: appointment.serviceId,
        professionalId: appointment.professionalId,
        isWalkIn: false,
        status: "aguardando",
        checkedInAt: new Date().toISOString(),
      };
      dispatch({ type: "addQueueEntry", entry });
      dispatch({ type: "updateAppointment", id: appointment.id, patch: { status: "aguardando" } });
      toast(`Check-in de ${entry.customerName} feito. Senha ${entry.ticket}.`, "sucesso");
    },
    [state.customers, nextTicket, dispatch, toast],
  );

  const addWalkIn = useCallback(
    (input: { name: string; serviceId?: string; professionalId?: string }) => {
      const entry: QueueEntry = {
        id: newId("q"),
        ticket: nextTicket(true),
        customerName: input.name.trim(),
        serviceId: input.serviceId,
        professionalId: input.professionalId,
        isWalkIn: true,
        status: "aguardando",
        checkedInAt: new Date().toISOString(),
      };
      dispatch({ type: "addQueueEntry", entry });
      toast(`Encaixe de ${entry.customerName} na fila. Senha ${entry.ticket}.`, "sucesso");
    },
    [nextTicket, dispatch, toast],
  );

  const updateQueue = useCallback(
    (entry: QueueEntry, status: QueueEntry["status"], professionalId?: string) => {
      const now = new Date().toISOString();
      const patch: Partial<QueueEntry> = { status };
      if (professionalId) patch.professionalId = professionalId;
      if (status === "chamado") patch.calledAt = now;
      if (status === "em_atendimento") patch.startedAt = now;
      if (status === "concluido" || status === "desistiu") patch.finishedAt = now;
      dispatch({ type: "updateQueueEntry", id: entry.id, patch, call: status === "chamado" });
      if (entry.appointmentId) {
        const apptStatus: Partial<Record<QueueEntry["status"], AppointmentStatus>> = {
          em_atendimento: "em_atendimento",
          concluido: "concluido",
          desistiu: "faltou",
        };
        const next = apptStatus[status];
        if (next) dispatch({ type: "updateAppointment", id: entry.appointmentId, patch: { status: next } });
      }
    },
    [dispatch],
  );

  return { saveAppointment, moveAppointment, setStatus, registerPayment, checkIn, addWalkIn, updateQueue };
}
