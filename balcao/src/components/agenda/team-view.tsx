"use client";

import { Avatar } from "@/components/ui/avatar";
import { statusDot } from "@/components/shared/status";
import { addDays, isSameDay } from "@/lib/dates";
import { formatTime, formatWeekday, statusLabel } from "@/lib/format";
import { useLookups, useNow } from "@/lib/store";
import type { Appointment, Professional, TimeBlock } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_PER_CELL = 2;

/** Visão por profissional: linhas = profissionais, colunas = dias da semana. */
export function TeamView({
  weekStart,
  professionals,
  appointments,
  blocks,
  onOpen,
  onPickDay,
}: {
  weekStart: Date;
  professionals: Professional[];
  appointments: Appointment[];
  blocks: TimeBlock[];
  onOpen: (a: Appointment) => void;
  onPickDay: (day: Date) => void;
}) {
  const { services, customers } = useLookups();
  const now = useNow(60_000);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border bg-surface">
      <table className="w-full min-w-[900px] table-fixed border-collapse">
        <caption className="sr-only">Agendamentos da semana por profissional</caption>
        <thead>
          <tr>
            <th scope="col" className="w-48 border-b border-border px-4 py-3 text-left text-xs font-semibold text-muted">
              Profissional
            </th>
            {days.map((d) => {
              const today = isSameDay(d, now);
              return (
                <th key={d.toISOString()} scope="col" className={cn("border-b border-l border-border px-2 py-2 text-left", today && "bg-primary-soft/40")}>
                  <button type="button" onClick={() => onPickDay(d)} className="flex items-baseline gap-1.5 rounded-lg px-1 hover:bg-surface-2">
                    <span className={cn("font-display text-2xl font-semibold", today && "text-primary")}>{d.getDate()}</span>
                    <span className="text-xs font-semibold text-muted uppercase">{formatWeekday(d)}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {professionals.map((p) => (
            <tr key={p.id}>
              <th scope="row" className="border-b border-border px-4 py-3 text-left align-top font-normal">
                <div className="flex items-center gap-2.5">
                  <Avatar name={p.name} hue={p.avatarHue} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-muted">{p.title}</div>
                  </div>
                </div>
              </th>
              {days.map((d) => {
                const items = appointments
                  .filter((a) => a.professionalId === p.id && isSameDay(new Date(a.start), d))
                  .sort((a, b) => a.start.localeCompare(b.start));
                const off = !p.workHours[d.getDay()]?.length;
                const dayBlock = blocks.find(
                  (b) =>
                    isSameDay(new Date(b.start), d) &&
                    (!b.professionalId || b.professionalId === p.id) &&
                    new Date(b.end).getTime() - new Date(b.start).getTime() > 8 * 3600_000,
                );
                const today = isSameDay(d, now);
                return (
                  <td key={d.toISOString()} className={cn("border-b border-l border-border p-1.5 align-top", today && "bg-primary-soft/25", (off || dayBlock) && "hatch")}>
                    {(off || dayBlock) && (
                      <span className="block rounded bg-surface/85 px-1.5 py-1 text-[11px] font-semibold text-muted">
                        {dayBlock?.reason ?? "Não trabalha"}
                      </span>
                    )}
                    <div className="flex flex-col gap-1">
                      {items.slice(0, MAX_PER_CELL).map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => onOpen(a)}
                          className={cn(
                            "svc rounded-lg px-2 py-1.5 text-left text-xs",
                            `svc-${services.get(a.serviceId)?.color}`,
                            (a.status === "cancelado" || a.status === "faltou") && "opacity-55",
                          )}
                        >
                          <span className="flex items-center justify-between gap-1">
                            <span className="truncate font-semibold">{services.get(a.serviceId)?.name}</span>
                            <span className="flex shrink-0 items-center gap-1 text-[10px] opacity-80">
                              <span className={cn("size-1.5 rounded-full", statusDot[a.status])} aria-hidden />
                              <span className="sr-only">{statusLabel[a.status]}</span>
                            </span>
                          </span>
                          <span className="block truncate opacity-85">
                            {formatTime(a.start)} - {formatTime(a.end)} · {customers.get(a.customerId)?.name.split(" ")[0]}
                          </span>
                        </button>
                      ))}
                      {items.length > MAX_PER_CELL && (
                        <button
                          type="button"
                          onClick={() => onPickDay(d)}
                          className="rounded-lg bg-surface-2 px-2 py-1 text-left text-xs font-semibold text-muted hover:text-text"
                        >
                          + {items.length - MAX_PER_CELL} mais
                        </button>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
