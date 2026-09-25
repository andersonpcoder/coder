"use client";

import { Ban } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Avatar } from "@/components/ui/avatar";
import { statusDot } from "@/components/shared/status";
import { addMinutes, atMinutes, isSameDay, minutesOfDay, toDateInput } from "@/lib/dates";
import { blockKindLabel, formatTime, statusLabel } from "@/lib/format";
import { layoutLanes } from "@/lib/scheduling";
import { useLookups, useNow } from "@/lib/store";
import type { Appointment, Professional, TimeBlock } from "@/lib/types";
import { cn } from "@/lib/utils";

export const HOUR_PX = 64;
const PX_PER_MIN = HOUR_PX / 60;
const SNAP = 15;

export interface GridColumn {
  key: string;
  day: Date;
  /** Na visão de dia cada coluna é um profissional. */
  professional?: Professional;
  label: string;
  sublabel?: string;
}

interface DragState {
  id: string;
  mode: "move" | "resize";
  originX: number;
  originY: number;
  fromCol: string;
  toCol: string;
  deltaMin: number;
  moved: boolean;
}

export function columnKey(day: Date, professionalId?: string) {
  return `${toDateInput(day)}|${professionalId ?? ""}`;
}

export function TimeGrid({
  columns,
  appointments,
  blocks,
  startMin,
  endMin,
  canEdit,
  onCreate,
  onOpen,
  onMove,
}: {
  columns: GridColumn[];
  appointments: Appointment[];
  blocks: TimeBlock[];
  startMin: number;
  endMin: number;
  canEdit: boolean;
  onCreate: (start: Date, professionalId?: string) => void;
  onOpen: (a: Appointment) => void;
  onMove: (id: string, start: Date, end: Date, professionalId: string) => void;
}) {
  const { services, customers, professionals } = useLookups();
  const now = useNow(30_000);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const suppressClick = useRef(false);
  const height = (endMin - startMin) * PX_PER_MIN;
  const hours = useMemo(() => {
    const list: number[] = [];
    for (let m = Math.ceil(startMin / 60) * 60; m < endMin; m += 60) list.push(m);
    return list;
  }, [startMin, endMin]);

  // Abre a grade já rolada para perto da hora atual.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = (minutesOfDay(new Date()) - startMin - 90) * PX_PER_MIN;
    el.scrollTop = Math.max(0, target);
  }, [startMin]);

  const byColumn = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const col of columns) map.set(col.key, []);
    for (const a of appointments) {
      const start = new Date(a.start);
      for (const col of columns) {
        if (!isSameDay(start, col.day)) continue;
        if (col.professional && col.professional.id !== a.professionalId) continue;
        map.get(col.key)!.push(a);
      }
    }
    return map;
  }, [columns, appointments]);

  const colByKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns]);

  const previewTimes = (a: Appointment, d: DragState) => {
    const start = new Date(a.start);
    const end = new Date(a.end);
    if (d.mode === "resize") {
      const newEnd = addMinutes(end, d.deltaMin);
      return { start, end: newEnd > addMinutes(start, SNAP) ? newEnd : addMinutes(start, SNAP) };
    }
    const target = colByKey.get(d.toCol);
    const day = target?.day ?? start;
    const s = atMinutes(day, minutesOfDay(start) + d.deltaMin);
    return { start: s, end: addMinutes(s, (end.getTime() - start.getTime()) / 60_000) };
  };

  const onPointerDown = (e: ReactPointerEvent, a: Appointment, colKey: string, mode: DragState["mode"]) => {
    // No toque a rolagem tem prioridade; a edição é feita pelo formulário.
    if (!canEdit || e.pointerType === "touch" || e.button !== 0) return;
    e.stopPropagation();
    // Evita seleção de texto enquanto arrasta.
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ id: a.id, mode, originX: e.clientX, originY: e.clientY, fromCol: colKey, toCol: colKey, deltaMin: 0, moved: false });
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag) return;
    const dy = e.clientY - drag.originY;
    const dx = e.clientX - drag.originX;
    const deltaMin = Math.round(dy / PX_PER_MIN / SNAP) * SNAP;
    let toCol = drag.toCol;
    if (drag.mode === "move") {
      const el = document
        .elementsFromPoint(e.clientX, e.clientY)
        .find((x) => (x as HTMLElement).dataset?.colKey) as HTMLElement | undefined;
      if (el?.dataset.colKey) toCol = el.dataset.colKey;
    }
    setDrag({ ...drag, deltaMin, toCol, moved: drag.moved || Math.abs(dy) > 4 || Math.abs(dx) > 4 });
  };

  const onPointerUp = () => {
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (!d.moved) return;
    suppressClick.current = true;
    const a = appointments.find((x) => x.id === d.id);
    if (!a) return;
    const { start, end } = previewTimes(a, d);
    const target = colByKey.get(d.toCol);
    const professionalId = d.mode === "move" && target?.professional ? target.professional.id : a.professionalId;
    if (start.getTime() === new Date(a.start).getTime() && end.getTime() === new Date(a.end).getTime() && professionalId === a.professionalId) return;
    onMove(a.id, start, end, professionalId);
  };

  const renderAppointment = (a: Appointment, lane: number, lanes: number, ghost = false, times?: { start: Date; end: Date }) => {
    const start = times?.start ?? new Date(a.start);
    const end = times?.end ?? new Date(a.end);
    const top = (minutesOfDay(start) - startMin) * PX_PER_MIN;
    const h = Math.max(18, ((end.getTime() - start.getTime()) / 60_000) * PX_PER_MIN - 2);
    const service = services.get(a.serviceId);
    const customer = customers.get(a.customerId);
    const pro = professionals.get(a.professionalId);
    const inactive = a.status === "cancelado" || a.status === "faltou";
    const compact = h < 44;
    const label = `${customer?.name}, ${service?.name} com ${pro?.name}, ${formatTime(start)} às ${formatTime(end)}, ${statusLabel[a.status]}`;
    return (
      <button
        key={a.id + (ghost ? "-ghost" : "")}
        type="button"
        aria-label={label}
        onPointerDown={(e) => onPointerDown(e, a, columnKeyOf(a), "move")}
        onClick={() => {
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          onOpen(a);
        }}
        className={cn(
          "svc group absolute overflow-hidden rounded-lg px-2 text-left text-xs shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-shadow hover:shadow-md",
          `svc-${service?.color ?? "menta"}`,
          compact ? "py-0.5" : "py-1.5",
          inactive && "opacity-55",
          ghost && "pointer-events-none z-20 shadow-lg ring-2 ring-primary",
          drag?.id === a.id && !ghost && "opacity-30",
          canEdit && "cursor-grab active:cursor-grabbing",
        )}
        style={{
          top,
          height: h,
          left: `calc(${(lane / lanes) * 100}% + 2px)`,
          width: `calc(${100 / lanes}% - 4px)`,
        }}
      >
        <span className="flex items-center gap-1.5">
          <span className={cn("size-1.5 shrink-0 rounded-full", statusDot[a.status])} aria-hidden />
          <span className={cn("truncate font-semibold", inactive && "line-through")}>{customer?.name}</span>
          {compact && <span className="ml-auto shrink-0 opacity-80">{formatTime(start)}</span>}
        </span>
        {!compact && (
          <>
            <span className="block truncate opacity-85">
              {formatTime(start)} - {formatTime(end)}
            </span>
            <span className="block truncate opacity-85">
              {service?.name}
              {!columnHasPro && pro ? ` · ${pro.name.split(" ")[0]}` : ""}
            </span>
          </>
        )}
        {canEdit && !inactive && (
          <span
            aria-hidden
            onPointerDown={(e) => onPointerDown(e, a, columnKeyOf(a), "resize")}
            className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100"
          >
            <span className="mx-auto mt-0.5 block h-1 w-6 rounded-full bg-current opacity-40" />
          </span>
        )}
      </button>
    );
  };

  const columnHasPro = !!columns[0]?.professional;
  const columnKeyOf = (a: Appointment) =>
    columnKey(new Date(a.start), columnHasPro ? a.professionalId : undefined);

  const dragged = drag ? appointments.find((a) => a.id === drag.id) : undefined;
  const nowTop = (minutesOfDay(now) - startMin) * PX_PER_MIN;
  const nowVisible = nowTop >= 0 && nowTop <= height && columns.some((c) => isSameDay(c.day, now));

  return (
    <div
      ref={scrollRef}
      className="relative max-h-[calc(100dvh-15rem)] min-h-[420px] overflow-auto rounded-[var(--radius-card)] border border-border bg-surface"
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
    >
      <div className="grid" style={{ gridTemplateColumns: `64px repeat(${columns.length}, minmax(${columnHasPro ? 150 : 110}px, 1fr))` }}>
        {/* Cabeçalho fixo */}
        <div className="sticky top-0 left-0 z-30 border-b border-border bg-surface" />
        {columns.map((col) => {
          const today = isSameDay(col.day, now);
          return (
            <div key={col.key} className="sticky top-0 z-20 border-b border-l border-border bg-surface px-2 py-2.5">
              {col.professional ? (
                <div className="flex items-center gap-2">
                  <Avatar name={col.professional.name} hue={col.professional.avatarHue} size="sm" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{col.label}</div>
                    <div className="truncate text-xs text-muted">{col.sublabel}</div>
                  </div>
                </div>
              ) : (
                <div className={cn("flex flex-col items-center rounded-lg py-0.5", today && "bg-text text-surface")}>
                  <span className={cn("text-xs uppercase", today ? "opacity-80" : "text-muted")}>{col.sublabel}</span>
                  <span className="font-display text-lg leading-6 font-semibold">{col.label}</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Régua de horas */}
        <div className="sticky left-0 z-10 bg-surface" style={{ height }}>
          {hours.map((m) => (
            <span
              key={m}
              className="absolute right-2 -translate-y-1/2 text-xs text-muted tabular-nums"
              style={{ top: (m - startMin) * PX_PER_MIN }}
            >
              {String(m / 60).padStart(2, "0")}:00
            </span>
          ))}
          {nowVisible && (
            <span
              className="absolute right-1 z-10 -translate-y-1/2 rounded-full bg-text px-1.5 py-0.5 text-[11px] font-semibold text-surface tabular-nums"
              style={{ top: nowTop }}
            >
              {formatTime(now)}
            </span>
          )}
        </div>

        {columns.map((col) => {
          const colAppointments = byColumn.get(col.key) ?? [];
          const lanes = layoutLanes(colAppointments);
          const colBlocks = blocks.filter(
            (b) =>
              isSameDay(new Date(b.start), col.day) &&
              (!b.professionalId || !col.professional || b.professionalId === col.professional.id),
          );
          const windows = col.professional ? (col.professional.workHours[col.day.getDay()] ?? []) : null;
          const today = isSameDay(col.day, now);
          return (
            <div
              key={col.key}
              data-col-key={col.key}
              className={cn("relative border-l border-border", today && !col.professional && "bg-primary-soft/25")}
              style={{ height }}
              onClick={(e) => {
                if (!canEdit || e.target !== e.currentTarget) return;
                const y = e.nativeEvent.offsetY;
                const minute = Math.floor(y / PX_PER_MIN / SNAP) * SNAP + startMin;
                onCreate(atMinutes(col.day, minute), col.professional?.id);
              }}
            >
              {hours.map((m) => (
                <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-border/70" style={{ top: (m - startMin) * PX_PER_MIN }} />
              ))}
              {/* Fora do expediente do profissional */}
              {windows !== null &&
                outsideWindows(windows, startMin, endMin).map(([s, e]) => (
                  <div
                    key={s}
                    className="pointer-events-none absolute inset-x-0 bg-surface-2/70"
                    style={{ top: (s - startMin) * PX_PER_MIN, height: (e - s) * PX_PER_MIN }}
                  />
                ))}
              {colBlocks.map((b) => {
                const s = Math.max(minutesOfDay(new Date(b.start)), startMin);
                const e = Math.min(minutesOfDay(new Date(b.end)) || 24 * 60, endMin);
                if (e <= s) return null;
                return (
                  <div
                    key={b.id}
                    className="hatch pointer-events-none absolute inset-x-0.5 flex items-start gap-1 overflow-hidden rounded-md px-2 py-1 text-[11px] font-semibold text-muted"
                    style={{ top: (s - startMin) * PX_PER_MIN, height: (e - s) * PX_PER_MIN - 1 }}
                  >
                    <Ban className="mt-px size-3 shrink-0" aria-hidden />
                    <span className="truncate rounded bg-surface/80 px-1">
                      {b.reason ?? blockKindLabel[b.kind]}
                      {!col.professional && b.professionalId ? ` · ${professionals.get(b.professionalId)?.name.split(" ")[0]}` : ""}
                    </span>
                  </div>
                );
              })}
              {lanes.map(({ item, lane, lanes: n }) => renderAppointment(item, lane, n))}
              {drag?.moved && dragged && drag.toCol === col.key && (() => {
                const times = previewTimes(dragged, drag);
                return renderAppointment(dragged, 0, 1, true, times);
              })()}
              {today && nowVisible && (
                <div className="pointer-events-none absolute inset-x-0 z-10 h-0.5 bg-text" style={{ top: nowTop }}>
                  <span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-text" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function outsideWindows(windows: { start: number; end: number }[], startMin: number, endMin: number): [number, number][] {
  if (!windows.length) return [[startMin, endMin]];
  const sorted = [...windows].sort((a, b) => a.start - b.start);
  const gaps: [number, number][] = [];
  let cursor = startMin;
  for (const w of sorted) {
    if (w.start > cursor) gaps.push([cursor, Math.min(w.start, endMin)]);
    cursor = Math.max(cursor, w.end);
  }
  if (cursor < endMin) gaps.push([cursor, endMin]);
  return gaps;
}
