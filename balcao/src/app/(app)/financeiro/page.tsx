"use client";

import { NextPhase } from "@/components/shell/next-phase";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays, isSameDay, startOfDay } from "@/lib/dates";
import { formatTime, money, paymentMethodLabel } from "@/lib/format";
import { useLookups, useStore } from "@/lib/store";
import type { PaymentMethod } from "@/lib/types";

export default function FinanceiroPage() {
  const { state } = useStore();
  const { currentUser, customers, professionals } = useLookups();
  const isAdmin = currentUser.role === "admin";
  const now = new Date();
  const today = state.payments.filter((p) => isSameDay(new Date(p.paidAt), now)).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const total = today.reduce((s, p) => s + p.amountCents, 0);
  const byMethod = (Object.keys(paymentMethodLabel) as PaymentMethod[]).map((m) => ({
    m,
    v: today.filter((p) => p.method === m).reduce((s, p) => s + p.amountCents, 0),
  }));
  const monthStart = addDays(startOfDay(now), -29);
  const month = state.payments.filter((p) => new Date(p.paidAt) >= monthStart);
  const commissions = state.professionals.map((p) => {
    const gross = month.filter((x) => x.professionalId === p.id).reduce((s, x) => s + x.amountCents, 0);
    return { p, gross, commission: Math.round((gross * p.commissionPct) / 100) };
  });

  return (
    <div>
      <PageHeader title="Financeiro" description={isAdmin ? "Caixa do dia e comissões" : "Caixa do dia (a recepção vê apenas o dia atual)"} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="p-4 lg:col-span-1">
          <div className="text-[13px] text-muted">Caixa de hoje</div>
          <div className="mt-1 font-display text-3xl font-semibold">{money(total)}</div>
        </Card>
        {byMethod.map(({ m, v }) => (
          <Card key={m} className="p-4">
            <div className="text-[13px] text-muted">{paymentMethodLabel[m]}</div>
            <div className="mt-1 font-display text-xl font-semibold">{money(v)}</div>
          </Card>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recebimentos de hoje</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {today.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <span className="w-12 text-muted tabular-nums">{formatTime(p.paidAt)}</span>
                  <span className="flex-1 truncate">{p.customerId ? customers.get(p.customerId)?.name : "Avulso"}</span>
                  <span className="text-muted">{paymentMethodLabel[p.method]}</span>
                  <span className="w-24 text-right font-semibold tabular-nums">{money(p.amountCents)}</span>
                </li>
              ))}
              {today.length === 0 && <li className="py-4 text-center text-muted">Nenhum recebimento ainda.</li>}
            </ul>
          </CardContent>
        </Card>
        {isAdmin && (
          <Card>
            <CardHeader><CardTitle>Comissões · últimos 30 dias</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y divide-border text-sm">
                {commissions.map(({ p, gross, commission }) => (
                  <li key={p.id} className="flex items-center gap-3 py-2">
                    <span className="flex-1">{professionals.get(p.id)?.name} <span className="text-muted">({p.commissionPct}%)</span></span>
                    <span className="text-muted tabular-nums">{money(gross)}</span>
                    <span className="w-24 text-right font-semibold tabular-nums">{money(commission)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
      <NextPhase items={["Relatório por período com filtros", "Fechamento de caixa", "Pagamento de comissões"]} />
    </div>
  );
}
