"use client";

import { Input, Select } from "@/components/ui/field";
import { addDays, addMonths, fromDateInput, startOfDay, startOfMonth, toDateInput } from "@/lib/dates";

export type PeriodKey = "hoje" | "7d" | "30d" | "mes" | "mes-passado" | "ano" | "personalizado";

export interface Period {
  key: PeriodKey;
  /** Início inclusivo. */
  from: Date;
  /** Fim exclusivo. */
  to: Date;
}

export const periodLabel: Record<PeriodKey, string> = {
  hoje: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  mes: "Este mês",
  "mes-passado": "Mês passado",
  ano: "Últimos 12 meses",
  personalizado: "Personalizado",
};

export function makePeriod(key: PeriodKey, custom?: { from: Date; to: Date }): Period {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1);
  switch (key) {
    case "hoje":
      return { key, from: today, to: tomorrow };
    case "7d":
      return { key, from: addDays(today, -6), to: tomorrow };
    case "30d":
      return { key, from: addDays(today, -29), to: tomorrow };
    case "mes":
      return { key, from: startOfMonth(today), to: tomorrow };
    case "mes-passado":
      return { key, from: addMonths(startOfMonth(today), -1), to: startOfMonth(today) };
    case "ano":
      return { key, from: addMonths(today, -12), to: tomorrow };
    case "personalizado":
      return { key, from: custom?.from ?? addDays(today, -29), to: custom?.to ?? tomorrow };
  }
}

export function inPeriod(iso: string, p: Period): boolean {
  const d = new Date(iso);
  return d >= p.from && d < p.to;
}

export function PeriodPicker({ value, onChange, options }: { value: Period; onChange: (p: Period) => void; options?: PeriodKey[] }) {
  const keys = options ?? (Object.keys(periodLabel) as PeriodKey[]);
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Select aria-label="Período" value={value.key} onChange={(e) => onChange(makePeriod(e.target.value as PeriodKey, value))} className="w-auto">
        {keys.map((k) => <option key={k} value={k}>{periodLabel[k]}</option>)}
      </Select>
      {value.key === "personalizado" && (
        <>
          <Input aria-label="De" type="date" className="w-auto" value={toDateInput(value.from)} onChange={(e) => e.target.value && onChange({ ...value, from: fromDateInput(e.target.value) })} />
          <Input aria-label="Até" type="date" className="w-auto" value={toDateInput(addDays(value.to, -1))} onChange={(e) => e.target.value && onChange({ ...value, to: addDays(fromDateInput(e.target.value), 1) })} />
        </>
      )}
    </div>
  );
}
