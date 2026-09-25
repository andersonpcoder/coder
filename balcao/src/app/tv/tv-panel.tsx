"use client";

import { useEffect, useRef } from "react";
import { isSameDay } from "@/lib/dates";
import { formatDayLong, formatTime } from "@/lib/format";
import { useLookups, useNow, useStore } from "@/lib/store";

/** Painel para TV da recepção: senha e nome chamados, atualizado em tempo real. */
export function TvPanel() {
  const { state } = useStore();
  const { professionals } = useLookups();
  const now = useNow(1000);
  const lastRef = useRef(state.lastCallId);

  const calls = state.queue
    .filter((q) => q.calledAt && isSameDay(new Date(q.calledAt), now))
    .sort((a, b) => b.calledAt!.localeCompare(a.calledAt!));
  const current = calls.find((q) => q.id === state.lastCallId) ?? calls[0];
  const previous = calls.filter((q) => q.id !== current?.id).slice(0, 4);
  const waiting = state.queue.filter((q) => q.status === "aguardando").length;

  // Toca um aviso quando outra aba chama uma nova senha.
  useEffect(() => {
    if (state.lastCallId && state.lastCallId !== lastRef.current) {
      try {
        const ctx = new AudioContext();
        [0, 0.25].forEach((t, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.value = i ? 660 : 880;
          g.gain.setValueAtTime(0.2, ctx.currentTime + t);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.35);
          o.connect(g).connect(ctx.destination);
          o.start(ctx.currentTime + t);
          o.stop(ctx.currentTime + t + 0.35);
        });
      } catch {
        // O navegador pode bloquear áudio sem interação prévia.
      }
    }
    lastRef.current = state.lastCallId;
  }, [state.lastCallId]);

  return (
    <div className="dark flex min-h-dvh flex-col bg-bg p-6 text-text sm:p-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="font-display text-2xl font-bold">{state.company.name}</p>
          <p className="text-muted first-letter:uppercase">{formatDayLong(now)}</p>
        </div>
        <p className="font-display text-5xl font-semibold tabular-nums">{formatTime(now)}</p>
      </header>

      <main className="grid flex-1 gap-8 py-8 lg:grid-cols-[2fr_1fr]" aria-live="assertive">
        <section className="flex flex-col items-center justify-center rounded-[28px] bg-primary p-8 text-center text-primary-fg">
          {current ? (
            <>
              <p className="text-2xl font-semibold opacity-80">Senha</p>
              <p className="font-display text-[clamp(5rem,16vw,12rem)] leading-none font-bold tracking-tight">{current.ticket}</p>
              <p className="mt-4 font-display text-[clamp(2rem,5vw,4rem)] font-semibold">{current.customerName}</p>
              {current.professionalId && (
                <p className="mt-2 text-2xl opacity-85">com {professionals.get(current.professionalId)?.name}</p>
              )}
            </>
          ) : (
            <p className="font-display text-4xl font-semibold">Aguardando chamadas</p>
          )}
        </section>
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-muted">Últimas chamadas</h2>
          {previous.map((q) => (
            <div key={q.id} className="flex items-center justify-between rounded-2xl bg-surface px-6 py-5">
              <span className="font-display text-4xl font-bold">{q.ticket}</span>
              <span className="text-right text-xl">{q.customerName.split(" ")[0]}</span>
            </div>
          ))}
          <p className="mt-auto text-lg text-muted">{waiting} pessoa(s) aguardando</p>
        </section>
      </main>
    </div>
  );
}
