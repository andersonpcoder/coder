import type { CSSProperties, ReactNode } from "react";

/** Aplica a cor da empresa na página pública. */
export function BrandScope({ color, children }: { color?: string; children: ReactNode }) {
  const c = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#0F6E63";
  const style = {
    "--primary": c,
    "--primary-hover": c,
    "--ring": c,
    "--primary-soft": `${c}1f`,
    "--primary-fg": "#ffffff",
  } as CSSProperties;
  return (
    <div style={style} className="min-h-dvh">
      {children}
    </div>
  );
}

export function googleCalendarUrl(input: { title: string; start: Date; end: Date; details?: string; location?: string }) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: input.title,
    dates: `${f(input.start)}/${f(input.end)}`,
    details: input.details ?? "",
    location: input.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
