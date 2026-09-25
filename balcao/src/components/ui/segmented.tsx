"use client";

import { cn } from "@/lib/utils";

/** Alternador em pílula (ex.: Dia / Semana / Mês), navegável por teclado. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; badge?: number }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-xl bg-surface-2 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors",
              active ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text",
            )}
          >
            {o.label}
            {o.badge !== undefined && o.badge > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-[11px] leading-5 text-white">{o.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
