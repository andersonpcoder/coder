"use client";

import { ArrowRight, CalendarCheck, Clock, Hourglass, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { ChannelIcon, StatusBadge } from "@/components/shared/status";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays, isSameDay, startOfDay, startOfWeek } from "@/lib/dates";
import { channelLabel, firstName, formatDayLong, formatDuration, formatTime, formatWeekday, money } from "@/lib/format";
import { useLookups, useNow, useStore } from "@/lib/store";
import type { BookingChannel } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function PainelPage() {
  const { state } = useStore();
  const { currentUser, customers, services, professionals } = useLookups();
  const now = useNow(30_000);
  const isPro = currentUser.role === "profissional";
  const isAdmin = currentUser.role === "admin";

  const scoped = useMemo(
    () => (isPro ? state.appointments.filter((a) => a.professionalId === currentUser.professionalId) : state.appointments),
    [state.appointments, isPro, currentUser.professionalId],
  );
  const today = scoped.filter((a) => isSameDay(new Date(a.start), now));
  const activeToday = today.filter((a) => a.status !== "cancelado");
  const waiting = state.queue.filter((q) => q.status === "aguardando" && isSameDay(new Date(q.checkedInAt), now));
  const waits = state.queue
    .filter((q) => q.startedAt && isSameDay(new Date(q.checkedInAt), now))
    .map((q) => (new Date(q.startedAt!).getTime() - new Date(q.checkedInAt).getTime()) / 60_000);
  const avgWait = waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0;

  // Comparecimento dos últimos 30 dias: concluídos / (concluídos + faltas).
  const since = addDays(startOfDay(now), -30);
  const recent = scoped.filter((a) => new Date(a.start) >= since && new Date(a.start) < now);
  const attended = recent.filter((a) => a.status === "concluido").length;
  const missed = recent.filter((a) => a.status === "faltou").length;
  const attendance = attended + missed ? Math.round((attended / (attended + missed)) * 100) : 100;

  const revenueToday = state.payments
    .filter((p) => isSameDay(new Date(p.paidAt), now) && (!isPro || p.professionalId === currentUser.professionalId))
    .reduce((s, p) => s + p.amountCents, 0);

  const weekStart = startOfWeek(now);
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return {
      day: d,
      count: scoped.filter((a) => isSameDay(new Date(a.start), d) && a.status !== "cancelado").length,
    };
  });

  const byChannel = (["whatsapp", "instagram", "site", "presencial", "telefone"] as BookingChannel[])
    .map((c) => ({ channel: c, count: recent.filter((a) => a.channel === c).length }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  const upcoming = scoped
    .filter((a) => new Date(a.start) > now && (a.status === "agendado" || a.status === "confirmado" || a.status === "aguardando"))
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 6);

  const team = state.professionals
    .filter((p) => !isPro || p.id === currentUser.professionalId)
    .map((p) => {
      const current = state.appointments.find(
        (a) => a.professionalId === p.id && a.status === "em_atendimento" && new Date(a.start) <= now,
      );
      const onBreak = state.blocks.some(
        (b) => b.professionalId === p.id && new Date(b.start) <= now && new Date(b.end) > now,
      );
      const works = (p.workHours[now.getDay()] ?? []).some((w) => {
        const m = now.getHours() * 60 + now.getMinutes();
        return m >= w.start && m < w.end;
      });
      const status = current ? "atendimento" : onBreak ? "pausa" : works ? "livre" : "fora";
      return { p, status, current };
    });

  return (
    <div>
      <PageHeader
        title={`Olá, ${firstName(currentUser.name)}`}
        description={<span className="first-letter:uppercase">{formatDayLong(now)} · {state.company.name}</span>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={CalendarCheck} label="Atendimentos hoje" value={String(activeToday.length)} hint={`${today.filter((a) => a.status === "concluido").length} concluídos`} />
        <Kpi icon={Hourglass} label="Clientes na espera" value={String(waiting.length)} hint="agora na fila" tone="accent" />
        <Kpi icon={Clock} label="Tempo médio de espera" value={formatDuration(avgWait)} hint="hoje" />
        <Kpi icon={TrendingUp} label="Comparecimento" value={`${attendance}%`} hint="últimos 30 dias" />
        {(isAdmin || currentUser.role === "recepcao" || isPro) && (
          <Kpi icon={Wallet} label={isPro ? "Seu faturamento hoje" : "Faturamento do dia"} value={money(revenueToday)} hint="pagamentos registrados" className="col-span-2 lg:col-span-1" />
        )}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Atendimentos por dia</CardTitle>
            <span className="text-sm text-muted">Esta semana</span>
          </CardHeader>
          <CardContent>
            <WeekBars data={week} now={now} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Por canal</CardTitle>
            <span className="text-sm text-muted">30 dias</span>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {byChannel.map(({ channel, count }) => {
              const total = byChannel.reduce((s, x) => s + x.count, 0);
              const pct = Math.round((count / total) * 100);
              return (
                <div key={channel}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium"><ChannelIcon channel={channel} /> {channelLabel[channel]}</span>
                    <span className="text-muted tabular-nums">{count} · {pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2" role="presentation">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Equipe agora</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {team.map(({ p, status, current }) => (
              <div key={p.id} className="flex items-center gap-3">
                <Avatar name={p.name} hue={p.avatarHue} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{p.name}</div>
                  <div className="truncate text-xs text-muted">
                    {current ? `${customers.get(current.customerId)?.name} · até ${formatTime(current.end)}` : p.title}
                  </div>
                </div>
                <Badge tone={status === "livre" ? "success" : status === "atendimento" ? "accent" : status === "pausa" ? "warning" : "neutral"}>
                  {status === "livre" ? "Livre" : status === "atendimento" ? "Em atendimento" : status === "pausa" ? "Em pausa" : "Fora do expediente"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Próximos agendamentos</CardTitle>
            <Link href="/agenda" className="flex min-h-11 items-center gap-1 text-sm font-semibold text-primary">
              Abrir agenda <ArrowRight className="size-4" />
            </Link>
          </CardHeader>
          <CardContent className="pt-2">
            <ul className="divide-y divide-border">
              {upcoming.map((a) => (
                <li key={a.id} className="flex items-center gap-3 py-2.5">
                  <div className="w-16 shrink-0">
                    <div className="text-sm font-semibold tabular-nums">{formatTime(a.start)}</div>
                    <div className="text-xs text-muted">{isSameDay(new Date(a.start), now) ? "hoje" : formatWeekday(a.start)}</div>
                  </div>
                  <span className={cn("svc h-9 w-1 shrink-0 rounded-full border-l-4", `svc-${services.get(a.serviceId)?.color}`)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{customers.get(a.customerId)?.name}</div>
                    <div className="truncate text-xs text-muted">
                      {services.get(a.serviceId)?.name} · {professionals.get(a.professionalId)?.name}
                    </div>
                  </div>
                  <StatusBadge status={a.status} className="hidden sm:inline-flex" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  className,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  hint: string;
  tone?: "accent";
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <Icon className={cn("size-4", tone === "accent" ? "text-accent" : "text-primary")} aria-hidden />
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold tabular-nums sm:text-3xl">{value}</div>
      <div className="text-xs text-muted">{hint}</div>
    </Card>
  );
}

function WeekBars({ data, now }: { data: { day: Date; count: number }[]; now: Date }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-56 items-end gap-2 sm:gap-4" role="img" aria-label={`Atendimentos por dia: ${data.map((d) => `${formatWeekday(d.day)} ${d.count}`).join(", ")}`}>
      {data.map((d) => {
        const today = isSameDay(d.day, now);
        const future = d.day > now && !today;
        return (
          <div key={d.day.toISOString()} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className="text-xs font-semibold tabular-nums">{d.count}</span>
            <div
              className={cn("w-full max-w-14 rounded-t-lg", today ? "bg-accent" : future ? "bg-primary/35" : "bg-primary")}
              style={{ height: `${(d.count / max) * 80}%`, minHeight: 4 }}
            />
            <span className={cn("text-xs capitalize", today ? "font-semibold" : "text-muted")}>{formatWeekday(d.day)}</span>
          </div>
        );
      })}
    </div>
  );
}
