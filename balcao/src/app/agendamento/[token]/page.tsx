"use client";

import { CalendarCheck, CalendarX2, CheckCircle2, MapPin, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FormError } from "@/components/auth/auth-shell";
import { BrandScope } from "@/components/public/brand";
import { SlotPicker } from "@/components/public/slot-picker";
import { StatusBadge } from "@/components/shared/status";
import { Button } from "@/components/ui/button";
import { formatDayLong, formatTime, money, setDisplayTimeZone } from "@/lib/format";
import { publicApi, type PublicAppointment } from "@/lib/public-api";

export default function GerenciarAgendamentoPage() {
  const { token } = useParams<{ token: string }>();
  const [appt, setAppt] = useState<PublicAppointment | null | undefined>(undefined);
  const [mode, setMode] = useState<"ver" | "remarcar" | "cancelar">("ver");
  const [slot, setSlot] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(
    () =>
      publicApi()
        .appointment(token)
        .then((a) => {
          setDisplayTimeZone(a?.timezone);
          setAppt(a);
        })
        .catch(() => setAppt(null)),
    [token],
  );
  useEffect(() => {
    reload();
  }, [reload]);

  const loadSlots = useCallback(
    (day: Date) => (appt ? publicApi().slots(appt.slug, appt.serviceId, appt.professionalId, day, token) : Promise.resolve([])),
    [appt, token],
  );

  const run = async (fn: () => Promise<void>, message: string) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setDone(message);
      setMode("ver");
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (appt === undefined) return <div className="grid min-h-dvh place-items-center text-muted" role="status">Carregando…</div>;
  if (appt === null) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Agendamento não encontrado</h1>
          <p className="mt-1 text-muted">O link pode estar incompleto. Fale com o estabelecimento.</p>
        </div>
      </div>
    );
  }

  const future = new Date(appt.start) > new Date();
  const editable = future && (appt.status === "agendado" || appt.status === "confirmado");

  return (
    <BrandScope color={appt.primaryColor}>
      <main className="mx-auto max-w-xl px-4 py-10 sm:px-6">
        <p className="text-sm font-semibold text-primary">{appt.company}</p>
        <h1 className="mt-1 text-2xl font-semibold">Olá, {appt.customer}! Este é o seu agendamento</h1>

        <div className="mt-6 rounded-[20px] border border-border bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold first-letter:uppercase">{formatDayLong(appt.start)}</p>
              <p className="font-display text-3xl font-bold">{formatTime(appt.start)}</p>
            </div>
            <StatusBadge status={appt.status} />
          </div>
          <p className="mt-3">{appt.service} com {appt.professional}</p>
          {appt.priceCents > 0 && <p className="text-sm text-muted">{money(appt.priceCents)}</p>}
          {appt.address && <p className="mt-2 flex items-center gap-1 text-sm text-muted"><MapPin className="size-4" aria-hidden /> {appt.address}</p>}
        </div>

        {done && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-2 text-sm" role="status">
            <CheckCircle2 className="size-4 text-primary" aria-hidden /> {done}
          </p>
        )}
        <div className="mt-4"><FormError message={error} /></div>

        {editable && mode === "ver" && (
          <div className="mt-6 flex flex-col gap-2">
            {appt.status === "agendado" && (
              <Button size="lg" disabled={busy} onClick={() => run(() => publicApi().confirm(token), "Presença confirmada. Até lá!")}>
                <CalendarCheck /> Confirmar presença
              </Button>
            )}
            <Button size="lg" variant="outline" onClick={() => setMode("remarcar")}><RefreshCw /> Remarcar</Button>
            <Button size="lg" variant="danger" onClick={() => setMode("cancelar")}><CalendarX2 /> Cancelar</Button>
          </div>
        )}

        {mode === "remarcar" && (
          <section className="mt-6" aria-labelledby="t-remarcar">
            <h2 id="t-remarcar" className="mb-3 text-lg font-semibold">Escolha o novo horário</h2>
            <SlotPicker load={loadSlots} value={slot} onChange={setSlot} />
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" onClick={() => setMode("ver")}>Voltar</Button>
              <Button disabled={!slot || busy} onClick={() => slot && run(() => publicApi().reschedule(token, slot), `Remarcado para ${formatDayLong(slot)} às ${formatTime(slot)}.`)}>
                Confirmar novo horário
              </Button>
            </div>
          </section>
        )}

        {mode === "cancelar" && (
          <section className="mt-6 rounded-2xl bg-danger-soft p-4" aria-labelledby="t-cancelar">
            <h2 id="t-cancelar" className="font-semibold">Cancelar este agendamento?</h2>
            <p className="mt-1 text-sm">O horário fica livre para outra pessoa.</p>
            <div className="mt-3 flex gap-2">
              <Button variant="ghost" onClick={() => setMode("ver")}>Manter</Button>
              <Button variant="danger" className="bg-danger text-white" disabled={busy} onClick={() => run(() => publicApi().cancel(token), "Agendamento cancelado.")}>Sim, cancelar</Button>
            </div>
          </section>
        )}

        {!editable && appt.status === "cancelado" && (
          <Button asChild className="mt-6"><Link href={`/${appt.slug}`}>Agendar outro horário</Link></Button>
        )}
      </main>
    </BrandScope>
  );
}
