"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { addDays, isSameDay, startOfDay } from "@/lib/dates";
import { formatDayLong, formatTime, formatWeekday } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Escolha de dia (próximas 3 semanas) e horário livre. */
export function SlotPicker({
  load,
  value,
  onChange,
}: {
  load: (day: Date) => Promise<Date[]>;
  value: Date | null;
  onChange: (slot: Date) => void;
}) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 21 }, (_, i) => addDays(today, i));
  const [day, setDay] = useState(today);
  const [slots, setSlots] = useState<Date[] | null>(null);
  const [error, setError] = useState("");
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setSlots(null);
    setError("");
    load(day)
      .then((s) => alive && setSlots(s))
      .catch((e) => alive && setError(String(e.message ?? e)));
    return () => {
      alive = false;
    };
  }, [day, load]);

  const scroll = (dir: number) => strip.current?.scrollBy({ left: dir * 280, behavior: "smooth" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={() => scroll(-1)} aria-label="Dias anteriores" className="hidden sm:inline-flex"><ChevronLeft /></Button>
        <div ref={strip} className="flex flex-1 gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Dia">
          {days.map((d) => {
            const active = isSameDay(d, day);
            return (
              <button
                key={d.toISOString()}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={formatDayLong(d)}
                onClick={() => setDay(d)}
                className={cn(
                  "flex min-h-16 min-w-14 shrink-0 flex-col items-center justify-center rounded-2xl border text-sm",
                  active ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface hover:border-primary",
                )}
              >
                <span className="text-xs uppercase opacity-80">{isSameDay(d, today) ? "hoje" : formatWeekday(d)}</span>
                <span className="font-display text-lg font-semibold">{d.getDate()}</span>
              </button>
            );
          })}
        </div>
        <Button variant="ghost" size="icon" onClick={() => scroll(1)} aria-label="Próximos dias" className="hidden sm:inline-flex"><ChevronRight /></Button>
      </div>
      <p className="text-sm font-semibold first-letter:uppercase">{formatDayLong(day)}</p>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      {slots === null && !error && <p className="text-sm text-muted" role="status">Buscando horários…</p>}
      {slots?.length === 0 && <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">Sem horários livres neste dia. Escolha outra data.</p>}
      {slots && slots.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="Horário">
          {slots.map((s) => {
            const active = value?.getTime() === s.getTime();
            return (
              <button
                key={s.toISOString()}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange(s)}
                className={cn(
                  "min-h-11 rounded-xl border text-sm font-semibold tabular-nums",
                  active ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface hover:border-primary",
                )}
              >
                {formatTime(s)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
