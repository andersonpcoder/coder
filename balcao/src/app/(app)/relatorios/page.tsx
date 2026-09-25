"use client";

import { Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { FeatureGate } from "@/components/shell/upgrade-notice";
import { ChannelIcon } from "@/components/shared/status";
import { inPeriod, makePeriod, PeriodPicker, periodLabel, type Period } from "@/components/shared/period";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays, startOfDay, toDateInput } from "@/lib/dates";
import { downloadFile, toCsv } from "@/lib/csv";
import { channelLabel, formatDate, money } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { BookingChannel } from "@/lib/types";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const brl = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export default function RelatoriosPage() {
  return (
    <FeatureGate feature="relatorios">
      <Relatorios />
    </FeatureGate>
  );
}

function Relatorios() {
  const { state } = useStore();
  const [period, setPeriod] = useState<Period>(() => makePeriod("30d"));

  const r = useMemo(() => {
    const appts = state.appointments.filter((a) => inPeriod(a.start, period) && new Date(a.start) <= new Date());
    const future = state.appointments.filter((a) => inPeriod(a.start, period) && new Date(a.start) > new Date());
    const done = appts.filter((a) => a.status === "concluido");
    const noShow = appts.filter((a) => a.status === "faltou");
    const cancelled = [...appts, ...future].filter((a) => a.status === "cancelado");
    const payments = state.payments.filter((p) => inPeriod(p.paidAt, period));
    const revenue = payments.reduce((s, p) => s + p.amountCents, 0);

    // Cliente novo: primeira visita concluída dentro do período.
    const firstVisit = new Map<string, string>();
    for (const a of state.appointments) {
      if (a.status !== "concluido") continue;
      const cur = firstVisit.get(a.customerId);
      if (!cur || a.start < cur) firstVisit.set(a.customerId, a.start);
    }
    const attended = new Set(done.map((a) => a.customerId));
    let newCustomers = 0;
    for (const id of attended) if (inPeriod(firstVisit.get(id)!, period)) newCustomers++;

    const byPro = state.professionals.map((p) => {
      const mine = appts.filter((a) => a.professionalId === p.id);
      const pay = payments.filter((x) => x.professionalId === p.id);
      return {
        name: p.name,
        total: mine.filter((a) => a.status !== "cancelado").length,
        done: mine.filter((a) => a.status === "concluido").length,
        noShow: mine.filter((a) => a.status === "faltou").length,
        revenue: pay.reduce((s, x) => s + x.amountCents, 0),
        commission: pay.reduce((s, x) => s + (x.commissionCents ?? 0), 0),
      };
    }).filter((x) => x.total || x.revenue);

    const byService = state.services.map((s) => {
      const mine = done.filter((a) => a.serviceId === s.id);
      return { name: s.name, count: mine.length, revenue: mine.reduce((sum, a) => sum + a.priceCents, 0) };
    }).filter((x) => x.count).sort((a, b) => b.count - a.count);

    const heat: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const a of appts) if (a.status !== "cancelado") heat[new Date(a.start).getDay()][new Date(a.start).getHours()]++;
    const hours = heat.flat().some(Boolean)
      ? Array.from({ length: 24 }, (_, h) => h).filter((h) => heat.some((row) => row[h]))
      : [];

    const byChannel = (Object.keys(channelLabel) as BookingChannel[])
      .map((c) => ({ c, n: appts.filter((a) => a.channel === c && a.status !== "cancelado").length }))
      .filter((x) => x.n)
      .sort((a, b) => b.n - a.n);

    const days: { day: Date; n: number }[] = [];
    const span = Math.min(62, Math.round((period.to.getTime() - period.from.getTime()) / 86_400_000));
    for (let i = 0; i < span; i++) {
      const d = addDays(startOfDay(period.from), i);
      if (d > new Date()) break;
      days.push({ day: d, n: appts.filter((a) => a.status !== "cancelado" && toDateInput(new Date(a.start)) === toDateInput(d)).length });
    }

    return { appts, done, noShow, cancelled, revenue, payments, newCustomers, returning: attended.size - newCustomers, byPro, byService, heat, hours, byChannel, days };
  }, [state, period]);

  const heatMax = Math.max(1, ...r.heat.flat());
  const dayMax = Math.max(1, ...r.days.map((d) => d.n));
  const valid = r.appts.filter((a) => a.status !== "cancelado").length;

  const exportAll = () => {
    const lines: (string | number)[][] = [
      ["Resumo", periodLabel[period.key], `${formatDate(period.from)} a ${formatDate(addDays(period.to, -1))}`],
      ["Atendimentos realizados", r.done.length],
      ["Faltas", r.noShow.length, `${pct(r.noShow.length, valid)}%`],
      ["Cancelamentos", r.cancelled.length],
      ["Faturamento", brl(r.revenue)],
      ["Clientes novos", r.newCustomers],
      ["Clientes recorrentes", r.returning],
      [],
      ["Profissional", "Agendamentos", "Concluídos", "Faltas", "Faturamento", "Comissão"],
      ...r.byPro.map((p) => [p.name, p.total, p.done, p.noShow, brl(p.revenue), brl(p.commission)]),
      [],
      ["Serviço", "Quantidade", "Faturamento"],
      ...r.byService.map((s) => [s.name, s.count, brl(s.revenue)]),
      [],
      ["Dia", ...Array.from({ length: 24 }, (_, h) => `${h}h`)],
      ...r.heat.map((row, d) => [WEEKDAYS[d], ...row]),
    ];
    downloadFile(`relatorio-${toDateInput(period.from)}.csv`, toCsv(["Balcão", state.company.name], lines));
  };

  return (
    <div className="print:text-black">
      <PageHeader
        title="Relatórios"
        description={`${state.company.name} · ${formatDate(period.from)} a ${formatDate(addDays(period.to, -1))}`}
        actions={
          <>
            <PeriodPicker value={period} onChange={setPeriod} />
            <Button variant="outline" onClick={exportAll} className="print:hidden"><Download /> CSV</Button>
            <Button variant="outline" onClick={() => window.print()} className="print:hidden"><Printer /> PDF</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 print:grid-cols-4">
        <Kpi label="Atendimentos realizados" value={String(r.done.length)} hint={`${valid} agendados no período`} />
        <Kpi label="Taxa de faltas" value={`${pct(r.noShow.length, valid)}%`} hint={`${r.noShow.length} faltas · ${r.cancelled.length} cancelamentos`} />
        <Kpi label="Faturamento" value={money(r.revenue)} hint={`ticket médio ${money(r.payments.length ? Math.round(r.revenue / r.payments.length) : 0)}`} />
        <Kpi label="Clientes novos x recorrentes" value={`${r.newCustomers} / ${r.returning}`} hint={`${pct(r.newCustomers, r.newCustomers + r.returning)}% novos`} />
      </div>

      <Card className="mt-5 break-inside-avoid">
        <CardHeader><CardTitle>Atendimentos por dia</CardTitle></CardHeader>
        <CardContent>
          <div className="flex h-40 items-end gap-0.5" role="img" aria-label="Atendimentos por dia no período">
            {r.days.map((d) => (
              <div key={d.day.toISOString()} className="flex h-full flex-1 flex-col justify-end" title={`${formatDate(d.day)}: ${d.n}`}>
                <div className="rounded-t bg-primary" style={{ height: `${(d.n / dayMax) * 100}%`, minHeight: d.n ? 3 : 0 }} />
              </div>
            ))}
          </div>
          {r.days.length > 0 && (
            <div className="mt-1 flex justify-between text-xs text-muted"><span>{formatDate(r.days[0].day)}</span><span>{formatDate(r.days[r.days.length - 1].day)}</span></div>
          )}
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-3 print:grid-cols-1">
        <Card className="break-inside-avoid xl:col-span-2">
          <CardHeader><CardTitle>Horários de pico</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {r.hours.length === 0 ? <p className="text-sm text-muted">Sem atendimentos no período.</p> : (
              <table className="text-xs" aria-label="Agendamentos por dia da semana e hora">
                <thead><tr><th />{r.hours.map((h) => <th key={h} className="px-1 pb-1 font-medium text-muted">{h}h</th>)}</tr></thead>
                <tbody>
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                    <tr key={d}>
                      <th scope="row" className="pr-2 text-left font-medium text-muted">{WEEKDAYS[d]}</th>
                      {r.hours.map((h) => {
                        const v = r.heat[d][h];
                        return (
                          <td key={h} className="p-0.5">
                            <div className={cn("grid size-8 place-items-center rounded-md tabular-nums", v ? "text-white" : "bg-surface-2 text-muted")} style={v ? { background: `color-mix(in srgb, var(--primary) ${20 + (v / heatMax) * 80}%, transparent)`, color: v / heatMax > 0.45 ? "white" : "var(--text)" } : undefined}>
                              {v || ""}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
        <Card className="break-inside-avoid">
          <CardHeader><CardTitle>Por canal</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {r.byChannel.map(({ c, n }) => (
              <div key={c}>
                <div className="mb-1 flex justify-between text-sm"><span className="flex items-center gap-2"><ChannelIcon channel={c} /> {channelLabel[c]}</span><span className="text-muted">{n} · {pct(n, valid)}%</span></div>
                <div className="h-2 rounded-full bg-surface-2"><div className="h-2 rounded-full bg-primary" style={{ width: `${pct(n, valid)}%` }} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2 print:grid-cols-1">
        <Card className="break-inside-avoid">
          <CardHeader><CardTitle>Por profissional</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs text-muted"><tr><th className="py-2">Profissional</th><th className="py-2 text-right">Concluídos</th><th className="py-2 text-right">Faltas</th><th className="py-2 text-right">Faturamento</th><th className="py-2 text-right">Comissão</th></tr></thead>
              <tbody className="divide-y divide-border">
                {r.byPro.map((p) => (
                  <tr key={p.name}><td className="py-2">{p.name}</td><td className="py-2 text-right tabular-nums">{p.done}</td><td className="py-2 text-right tabular-nums">{p.noShow} ({pct(p.noShow, p.total)}%)</td><td className="py-2 text-right tabular-nums">{money(p.revenue)}</td><td className="py-2 text-right tabular-nums">{money(p.commission)}</td></tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <Card className="break-inside-avoid">
          <CardHeader><CardTitle>Por serviço</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted"><tr><th className="py-2">Serviço</th><th className="py-2 text-right">Qtd.</th><th className="py-2 text-right">Faturamento</th><th className="py-2 text-right">Participação</th></tr></thead>
              <tbody className="divide-y divide-border">
                {r.byService.map((s) => (
                  <tr key={s.name}><td className="py-2">{s.name}</td><td className="py-2 text-right tabular-nums">{s.count}</td><td className="py-2 text-right tabular-nums">{money(s.revenue)}</td><td className="py-2 text-right tabular-nums">{pct(s.count, r.done.length)}%</td></tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="break-inside-avoid p-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{hint}</div>
    </Card>
  );
}
