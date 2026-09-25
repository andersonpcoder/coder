import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-fg" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M4 10h16M6 10v9M18 10v9M3 19h18M8 6h8" />
        </svg>
      </span>
      <span className="font-display text-xl font-bold tracking-tight">Balcão</span>
    </span>
  );
}
