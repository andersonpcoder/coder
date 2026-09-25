"use client";

import { addDays, isSameDay, startOfMonth, startOfWeek } from "@/lib/dates";
import { formatDayLong, formatTime } from "@/lib/format";
import { useLookups, useNow } from "@/lib/store";
import type { Appointment, TimeBlock } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function MonthView({
  cursor,
  appointments,
  blocks,
  onPickDay,
  onOpen,
}: {
  cursor: Date;
  appointments: Appointment[];
  blocks: TimeBlock[];
  onPickDay: (day: Date) => void;
  onOpen: (a: Appointment) => void;
}) {
  const { services, customers } = useLookups();
  const now = useNow(60_000);
  const first = startOfWeek(startOfMonth(cursor));
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i));

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-muted uppercase">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = day.getMonth() === cursor.getMonth();
          const items = appointments
            .filter((a) => isSameDay(new Date(a.start), day))
            .sort((a, b) => a.start.localeCompare(b.start));
          const holiday = blocks.find((b) => !b.professionalId && isSameDay(new Date(b.start), day));
          const today = isSameDay(day, now);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "flex min-h-24 flex-col gap-1 border-b border-l border-border p-1.5 first:border-l-0 sm:min-h-32",
                !inMonth && "bg-surface-2/50",
                holiday && "hatch",
              )}
            >
              <button
                type="button"
                onClick={() => onPickDay(day)}
                aria-label={`Ver ${formatDayLong(day)}, ${items.length} agendamentos`}
                className={cn(
                  "grid size-8 place-items-center self-start rounded-full text-sm font-semibold hover:bg-surface-2",
                  !inMonth && "text-muted",
                  today && "bg-text text-surface hover:bg-text",
                )}
              >
                {day.getDate()}
              </button>
              {holiday && <span className="truncate rounded bg-surface px-1 text-[11px] font-semibold text-muted">{holiday.reason}</span>}
              <div className="hidden flex-col gap-1 sm:flex">
                {items.slice(0, 3).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onOpen(a)}
                    className={cn("svc truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium", `svc-${services.get(a.serviceId)?.color}`)}
                  >
                    {formatTime(a.start)} {customers.get(a.customerId)?.name.split(" ")[0]}
                  </button>
                ))}
                {items.length > 3 && (
                  <button type="button" onClick={() => onPickDay(day)} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-left text-[11px] font-semibold text-muted">
                    + {items.length - 3} mais
                  </button>
                )}
              </div>
              {items.length > 0 && (
                <span className="text-[11px] font-semibold text-primary sm:hidden">{items.length} agend.</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
