import { addDays, addMinutes, addMonths, atMinutes, isSameDay, minutesOfDay, overlaps, startOfDay } from "./dates";
import type { Appointment, Professional, Recurrence, TimeBlock } from "./types";

/** Status que ocupam a agenda. Cancelados e faltas liberam o horário. */
export function occupiesSlot(a: Appointment): boolean {
  return a.status !== "cancelado" && a.status !== "faltou";
}

export type Conflict =
  | { kind: "agendamento"; appointment: Appointment }
  | { kind: "bloqueio"; block: TimeBlock };

/**
 * Procura conflitos para um profissional num intervalo. Mesma regra da
 * restrição appointments_no_overlap do banco, mais os bloqueios de horário.
 */
export function findConflict(
  professionalId: string,
  start: Date,
  end: Date,
  appointments: Appointment[],
  blocks: TimeBlock[],
  ignoreId?: string,
): Conflict | null {
  for (const a of appointments) {
    if (a.id === ignoreId || a.professionalId !== professionalId || !occupiesSlot(a)) continue;
    if (overlaps(start, end, new Date(a.start), new Date(a.end))) return { kind: "agendamento", appointment: a };
  }
  for (const b of blocks) {
    if (b.professionalId && b.professionalId !== professionalId) continue;
    if (overlaps(start, end, new Date(b.start), new Date(b.end))) return { kind: "bloqueio", block: b };
  }
  return null;
}

export function isWithinWorkHours(pro: Professional, start: Date, end: Date): boolean {
  if (!isSameDay(start, addMinutes(end, -1))) return false;
  const windows = pro.workHours[start.getDay()] ?? [];
  const s = minutesOfDay(start);
  const e = s + (end.getTime() - start.getTime()) / 60_000;
  return windows.some((w) => s >= w.start && e <= w.end);
}

/** Horários livres de um profissional num dia, em passos de 15 minutos. */
export function availableSlots(
  pro: Professional,
  day: Date,
  durationMin: number,
  appointments: Appointment[],
  blocks: TimeBlock[],
  now = new Date(),
): Date[] {
  const slots: Date[] = [];
  for (const w of pro.workHours[day.getDay()] ?? []) {
    for (let m = w.start; m + durationMin <= w.end; m += 15) {
      const start = atMinutes(day, m);
      if (start <= now) continue;
      if (!findConflict(pro.id, start, addMinutes(start, durationMin), appointments, blocks)) slots.push(start);
    }
  }
  return slots;
}

/** Próximos horários livres a partir de hoje, para respostas rápidas no chat. */
export function nextAvailableSlots(
  pro: Professional,
  durationMin: number,
  appointments: Appointment[],
  blocks: TimeBlock[],
  count: number,
  now = new Date(),
): Date[] {
  const found: Date[] = [];
  for (let d = 0; d < 14 && found.length < count; d++) {
    const daySlots = availableSlots(pro, addDays(startOfDay(now), d), durationMin, appointments, blocks, now);
    // Espalha as sugestões em vez de oferecer horários colados.
    for (let i = 0; i < daySlots.length && found.length < count; i += 4) found.push(daySlots[i]);
  }
  return found;
}

export function recurrenceDates(start: Date, rule: Recurrence, occurrences: number): Date[] {
  if (rule === "nenhuma") return [start];
  const dates: Date[] = [];
  for (let i = 0; i < occurrences; i++) {
    if (rule === "semanal") dates.push(addDays(start, 7 * i));
    else if (rule === "quinzenal") dates.push(addDays(start, 14 * i));
    else dates.push(addMonths(start, i));
  }
  return dates;
}

export interface Positioned<T> {
  item: T;
  lane: number;
  lanes: number;
}

/**
 * Distribui itens sobrepostos em colunas lado a lado, como nos calendários
 * de semana: cada grupo de itens que se tocam divide a largura igualmente.
 */
export function layoutLanes<T extends { start: string; end: string }>(items: T[]): Positioned<T>[] {
  const sorted = [...items].sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end));
  const result: Positioned<T>[] = [];
  let cluster: Positioned<T>[] = [];
  let laneEnds: string[] = [];
  let clusterEnd = "";

  const flush = () => {
    for (const p of cluster) p.lanes = laneEnds.length;
    result.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const item of sorted) {
    if (cluster.length && item.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    cluster.push({ item, lane, lanes: 0 });
    clusterEnd = cluster.length === 1 || item.end > clusterEnd ? item.end : clusterEnd;
  }
  flush();
  return result;
}
