"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, dismissToast } = useStore();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end"
    >
      {toasts.map((t) => {
        const Icon = t.tone === "erro" ? TriangleAlert : t.tone === "sucesso" ? CheckCircle2 : Info;
        return (
          <div
            key={t.id}
            role={t.tone === "erro" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border bg-surface px-4 py-3 text-sm shadow-lg",
              t.tone === "erro" ? "border-danger/40" : "border-border",
            )}
          >
            <Icon
              className={cn(
                "mt-0.5 size-5 shrink-0",
                t.tone === "erro" ? "text-danger" : t.tone === "sucesso" ? "text-success" : "text-primary",
              )}
            />
            <p className="flex-1">{t.message}</p>
            <button onClick={() => dismissToast(t.id)} aria-label="Fechar aviso" className="-m-1 p-1 text-muted">
              <X className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
