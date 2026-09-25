"use client";

import { ArrowRight, BellRing, CheckCircle2, Clock, LogIn, Megaphone, MonitorPlay, Play, UserPlus, UserX } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { FeatureGate } from "@/components/shell/upgrade-notice";
import { PaymentDialog, type PaymentTarget } from "@/components/shared/payment-dialog";
import { StatusBadge } from "@/components/shared/status";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { useActions } from "@/lib/actions";
import { isSameDay } from "@/lib/dates";
import { formatDuration, formatElapsed, formatTime } from "@/lib/format";
import { useActiveProfessionals, useLookups, useNow, useStore } from "@/lib/store";
import type { QueueEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function FilaPage() {
  return (
    <FeatureGate feature="fila">
      <FilaPageContent />
    </FeatureGate>
  );
}

function FilaPageContent() {
  const { state } = useStore();
  const { services, professionals } = useLookups();
  const { checkIn, updateQueue } = useActions();
  const activePros = useActiveProfessionals();
  const now = useNow(1000);
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [callPro, setCallPro] = useState("");
  const [payment, setPayment] = useState<PaymentTarget | null>(null);

  const today = state.queue.filter((q) => isSameDay(new Date(q.checkedInAt), now));
  // Ordem de chegada; quem tem horário marcado e já passou da hora sobe na fila.
  const waiting = useMemo(
    () =>
      today
        .filter((q) => q.status === "aguardando")
        .sort((a, b) => priority(a, state) - priority(b, state)),
    [today, state],
  );
  const called = today.filter((q) => q.status === "chamado");
  const inService = today.filter((q) => q.status === "em_atendimento");
  const done = today.filter((q) => q.status === "concluido");

  const arrivals = state.appointments
    .filter(
      (a) =>
        isSameDay(new Date(a.start), now) &&
        (a.status === "agendado" || a.status === "confirmado") &&
        !state.queue.some((q) => q.appointmentId === a.id),
    )
    .sort((a, b) => a.start.localeCompare(b.start));

  const waits = [...done, ...inService]
    .filter((q) => q.startedAt)
    .map((q) => new Date(q.startedAt!).getTime() - new Date(q.checkedInAt).getTime());
  const avgWait = waits.length ? waits.reduce((s, x) => s + x, 0) / waits.length : 0;

  const callNext = () => {
    const next = waiting.find((q) => !callPro || !q.professionalId || q.professionalId === callPro);
    if (!next) return;
    updateQueue(next, "chamado", next.professionalId ?? (callPro || undefined));
    announce();
  };

  const finish = (q: QueueEntry) => {
    updateQueue(q, "concluido");
    const appt = state.appointments.find((a) => a.id === q.appointmentId);
    const svc = q.serviceId ? services.get(q.serviceId) : undefined;
    setPayment({
      title: `${q.customerName}${svc ? ` · ${svc.name}` : ""}`,
      amountCents: appt?.priceCents ?? svc?.priceCents ?? 0,
      appointmentId: q.appointmentId,
      customerId: q.customerId,
      professionalId: q.professionalId,
    });
  };

  return (
    <div>
      <PageHeader
        title="Fila de atendimento"
        description="Check-in, chamada e encaixes em tempo real."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/tv" target="_blank">
                <MonitorPlay /> Painel de TV
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setWalkInOpen(true)}>
              <UserPlus /> Encaixe
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Na espera" value={String(waiting.length)} tone="accent" />
        <Stat label="Em atendimento" value={String(inService.length)} />
        <Stat label="Espera média hoje" value={formatDuration(avgWait / 60_000)} />
        <Stat label="Atendidos hoje" value={String(done.length)} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Field label="Chamar para" className="sm:w-64">
                {(id) => (
                  <Select id={id} value={callPro} onChange={(e) => setCallPro(e.target.value)}>
                    <option value="">Qualquer profissional</option>
                    {activePros.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Button size="lg" className="flex-1" onClick={callNext} disabled={!waiting.length}>
                <Megaphone className="!size-5" /> Chamar próximo
                {waiting[0] && <span className="font-normal opacity-85">· {waiting[0].ticket}</span>}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aguardando ({waiting.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {waiting.length === 0 ? (
                <Empty text="Ninguém esperando agora." />
              ) : (
                <ol className="flex flex-col gap-2">
                  {waiting.map((q, i) => {
                    const waitMs = now.getTime() - new Date(q.checkedInAt).getTime();
                    const pro = q.professionalId ? professionals.get(q.professionalId) : undefined;
                    const appt = q.appointmentId ? state.appointments.find((a) => a.id === q.appointmentId) : undefined;
                    return (
                      <li key={q.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3">
                        <span className="grid w-14 place-items-center rounded-xl bg-surface-2 py-2 font-display text-lg font-bold tabular-nums">
                          {q.ticket}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{q.customerName}</span>
                            {i === 0 && <Badge tone="primary">Próximo</Badge>}
                            {q.isWalkIn ? <Badge tone="accent">Encaixe</Badge> : appt && <Badge>Horário {formatTime(appt.start)}</Badge>}
                          </div>
                          <div className="text-[13px] text-muted">
                            {q.serviceId ? services.get(q.serviceId)?.name : "Serviço a definir"} · {pro?.name ?? "Qualquer profissional"}
                          </div>
                        </div>
                        <span
                          className={cn(
                            "flex items-center gap-1 text-sm font-semibold tabular-nums",
                            waitMs > 20 * 60_000 ? "text-danger" : waitMs > 10 * 60_000 ? "text-warning" : "text-muted",
                          )}
                          aria-label={`Esperando há ${formatDuration(waitMs / 60_000)}`}
                        >
                          <Clock className="size-4" /> {formatElapsed(waitMs)}
                        </span>
                        <div className="flex gap-1">
                          <Button size="sm" variant="soft" onClick={() => { updateQueue(q, "chamado", q.professionalId); announce(); }}>
                            <BellRing /> Chamar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => updateQueue(q, "desistiu")} aria-label={`${q.customerName} desistiu`}>
                            <UserX />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          {(called.length > 0 || inService.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Chamados e em atendimento</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {[...called, ...inService].map((q) => {
                  const pro = q.professionalId ? professionals.get(q.professionalId) : undefined;
                  const since = q.status === "chamado" ? q.calledAt : q.startedAt;
                  return (
                    <div key={q.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 p-3">
                      <span className="grid w-14 place-items-center rounded-xl bg-surface py-2 font-display text-lg font-bold">{q.ticket}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{q.customerName}</div>
                        <div className="text-[13px] text-muted">
                          {q.status === "chamado" ? "Chamado" : "Em atendimento"} · {pro?.name ?? "Sem profissional"}
                          {since && ` · ${formatElapsed(now.getTime() - new Date(since).getTime())}`}
                        </div>
                      </div>
                      {q.status === "chamado" ? (
                        <Button size="sm" onClick={() => updateQueue(q, "em_atendimento")}>
                          <Play /> Iniciar
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => finish(q)}>
                          <CheckCircle2 /> Concluir
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Chegadas previstas hoje</CardTitle>
            <span className="text-sm text-muted">{arrivals.length}</span>
          </CardHeader>
          <CardContent>
            {arrivals.length === 0 ? (
              <Empty text="Todos os clientes de hoje já chegaram." />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {arrivals.slice(0, 12).map((a) => {
                  const customer = state.customers.find((c) => c.id === a.customerId);
                  const late = new Date(a.start) < now;
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-2.5">
                      <span className={cn("w-12 text-sm font-semibold tabular-nums", late && "text-danger")}>{formatTime(a.start)}</span>
                      <Avatar name={customer?.name ?? "?"} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{customer?.name}</div>
                        <div className="truncate text-xs text-muted">
                          {services.get(a.serviceId)?.name} · {professionals.get(a.professionalId)?.name.split(" ")[0]}
                        </div>
                      </div>
                      <StatusBadge status={a.status} className="hidden sm:inline-flex" />
                      <Button size="sm" variant="outline" onClick={() => checkIn(a)}>
                        <LogIn /> Check-in
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            {arrivals.length > 12 && (
              <Link href="/agenda" className="mt-3 flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">
                Ver agenda completa <ArrowRight className="size-4" />
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <WalkInDialog open={walkInOpen} onClose={() => setWalkInOpen(false)} />
      <PaymentDialog target={payment} onClose={() => setPayment(null)} />
    </div>
  );
}

function priority(q: QueueEntry, state: ReturnType<typeof useStore>["state"]): number {
  const checkedIn = new Date(q.checkedInAt).getTime();
  if (q.isWalkIn || !q.appointmentId) return checkedIn;
  const appt = state.appointments.find((a) => a.id === q.appointmentId);
  // Com horário marcado, vale o menor entre chegada e horário agendado.
  return appt ? Math.min(checkedIn, new Date(appt.start).getTime()) : checkedIn;
}

/** Aviso sonoro curto ao chamar (o painel de TV também toca). */
function announce() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.4);
  } catch {
    // Sem áudio disponível: a chamada segue só visual.
  }
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "accent" }) {
  return (
    <Card className="p-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className={cn("mt-1 font-display text-2xl font-semibold tabular-nums", tone === "accent" && "text-accent")}>{value}</div>
    </Card>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-2xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">{text}</p>;
}

function WalkInDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useStore();
  const { addWalkIn } = useActions();
  const activePros = useActiveProfessionals();
  const [name, setName] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const submit = () => {
    if (!name.trim()) return;
    addWalkIn({ name, serviceId: serviceId || undefined, professionalId: professionalId || undefined });
    setName("");
    setServiceId("");
    setProfessionalId("");
    onClose();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Encaixe"
      description="Cliente sem horário marcado entra na fila com senha E."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={!name.trim()}>Colocar na fila</Button>
        </>
      }
    >
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Nome do cliente">
          {(id) => <Input id={id} autoFocus value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Serviço">
          {(id) => (
            <Select id={id} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">A definir</option>
              {state.services.filter((s) => s.active).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Profissional">
          {(id) => (
            <Select id={id} value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              <option value="">Qualquer um disponível</option>
              {activePros
                .filter((p) => !serviceId || p.serviceIds.includes(serviceId))
                .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
