import { cn } from "@/lib/utils";

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function hueOf(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export function Avatar({
  name,
  hue,
  size = "md",
  className,
}: {
  name: string;
  hue?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const hh = hue ?? hueOf(name);
  return (
    <span
      aria-hidden
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold",
        size === "sm" && "size-7 text-[11px]",
        size === "md" && "size-9 text-xs",
        size === "lg" && "size-12 text-sm",
        className,
      )}
      style={{ background: `hsl(${hh} 55% 88%)`, color: `hsl(${hh} 45% 25%)` }}
    >
      {initialsOf(name)}
    </span>
  );
}
