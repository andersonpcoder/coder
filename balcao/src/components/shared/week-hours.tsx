"use client";

import { Input } from "@/components/ui/field";
import type { WorkHours } from "@/lib/types";

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const ORDER = [1, 2, 3, 4, 5, 6, 0];

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMin = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Editor de horário semanal (um intervalo por dia), usado na equipe e nas unidades. */
export function WeekHoursEditor({ value, onChange }: { value: WorkHours; onChange: (v: WorkHours) => void }) {
  const set = (day: number, window?: { start: number; end: number }) => {
    const next = { ...value };
    if (window) next[day] = [window];
    else delete next[day];
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      {ORDER.map((day) => {
        const w = value[day]?.[0];
        return (
          <div key={day} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 sm:grid-cols-[140px_1fr_1fr]">
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-5 accent-[var(--primary)]"
                checked={!!w}
                onChange={(e) => set(day, e.target.checked ? { start: 9 * 60, end: 18 * 60 } : undefined)}
              />
              {DAYS[day]}
            </label>
            {w ? (
              <>
                <Input aria-label={`${DAYS[day]}: início`} type="time" step={900} value={hhmm(w.start)} onChange={(e) => e.target.value && set(day, { ...w, start: toMin(e.target.value) })} className="w-28 sm:w-auto" />
                <Input aria-label={`${DAYS[day]}: fim`} type="time" step={900} value={hhmm(w.end)} onChange={(e) => e.target.value && set(day, { ...w, end: toMin(e.target.value) })} className="w-28 sm:w-auto" />
              </>
            ) : (
              <span className="col-span-2 text-sm text-muted">Fechado</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function isValidHours(value: WorkHours): boolean {
  return Object.values(value).every((list) => list.every((w) => w.end > w.start));
}
