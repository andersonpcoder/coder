"use client";

import { Download, HandCoins, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { PaymentDialog, type PaymentTarget } from "@/components/shared/payment-dialog";
import { inPeriod, makePeriod, PeriodPicker, periodLabel, type Period } from "@/components/shared/period";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select } from "@/components/ui/field";
import { downloadFile, toCsv } from "@/lib/csv";
import { formatDate, formatTime, money, paymentMethodLabel } from "@/lib/format";
import { useLookups, useStore } from "@/lib/store";
import type { PaymentMethod } from "@/lib/types";

export default function FinanceiroPage() {
  const { state } = useStore();
  const { currentUser, customers, professionals, services } = useLookups();
  const isAdmin = currentUser.role === "admin";
  const [period, setPeriod] = useState<Period>(() => makePeriod(isAdmin ? "mes" : "hoje"));
  const [payment, setPayment] = useState<PaymentTarget | null>(null);
  const [loose, setLoose] = useState(false);
  // Recepção vê só o caixa do dia (mesma regra das políticas do banco).
  const p = isAdmin ? period : makePeriod("hoje");

  const payments = useMemo(
    () => state.payments.filter((x) => inPeriod(x.paidAt, p)).sort((a, b) => b.paidAt.localeCompare(a.paidAt)),
    [state.payments, p],
  );
  const total = payments.reduce((s, x) => s + x.amountCents, 0);
  const byMethod = (Object.keys(paymentMethodLabel) as PaymentMethod[]).map((m) => ({
    m,
    v: payments.filter((x) => x.method === m).reduce((s, x) => s + x.amountCents, 0),
  }));
  const commissions = state.professionals
    .map((pro) => {
      const list = payments.filter((x) => x.professionalId === pro.id);
      const gross = list.reduce((s, x) => s + x.amountCents, 0);
      const commission = list.reduce((s, x) => s + (x.commissionCents ?? Math.round((x.amountCents * pro.commissionPct) / 100)), 0);
      return { pro, count: list.length, gross, commission };
    })
    .filter((c) => c.count > 0 || c.pro.active);

  const paidAppointments = new Set(state.payments.map((x) => x.appointmentId).filter(Boolean));
  const pending = state.appointments
    .filter((a) => a.status === "concluido" && a.priceCents > 0 && !paidAppointments.has(a.id) && inPeriod(a.start, p))
    .sort((a, b) => b.start.localeCompare(a.start));

  const exportPayments = () =>
    downloadFile(
      `recebimentos-${formatDate(p.from).replace(/\//g, "-")}.csv`,
      toCsv(
        ["data", "hora", "cliente", "servico", "profissional", "forma", "valor", "comissao"],
        payments.map((x) => {
          const appt = state.appointments.find((a) => a.id === x.appointmentId);
          return [
            formatDate(x.paidAt), formatTime(x.paidAt),
            x.customerId ? customers.get(x.customerId)?.name : "Avulso",
            appt ? services.get(appt.serviceId)?.name : "",
            x.professionalId ? professionals.get(x.professionalId)?.name : "",
            paymentMethodLabel[x.method], (x.amountCents / 100).toFixed(2).replace(".", ","),
            ((x.commissionCents ?? 0) / 100).toFixed(2).replace(".", ","),
          ];
        }),
      ),
    );

  const exportCommissions = () =>
    downloadFile(
      "comissoes.csv",
      toCsv(
        ["profissional", "percentual", "atendimentos_pagos", "faturado", "comissao"],
        commissions.map((c) => [c.pro.name, c.pro.commissionPct, c.count, (c.gross / 100).toFixed(2).replace(".", ","), (c.commission / 100).toFixed(2).replace(".", ",")]),
      ),
    );

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description={isAdmin ? `${periodLabel[p.key]}: ${formatDate(p.from)} a ${formatDate(new Date(p.to.getTime() - 1))}` : "Caixa do dia"}
        actions={
          <>
            {isAdmin && <PeriodPicker value={period} onChange={setPeriod} />}
            <Button variant="outline" onClick={exportPayments}><Download /> CSV</Button>
            <Button onClick={() => setLoose(true)}><Plus /> Registrar recebimento</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Card className="col-span-2 p-4">
          <div className="text-[13px] text-muted">Recebido no período</div>
          <div className="mt-1 font-display text-3xl font-semibold">{money(total)}</div>
          <div className="text-xs text-muted">{payments.length} recebimentos · ticket médio {money(payments.length ? Math.round(total / payments.length) : 0)}</div>
        </Card>
        {byMethod.map(({ m, v }) => (
          <Card key={m} className="p-4">
            <div className="text-[13px] text-muted">{paymentMethodLabel[m]}</div>
            <div className="mt-1 font-display text-xl font-semibold">{money(v)}</div>
          </Card>
        ))}
      </div>

      {pending.length > 0 && (
        <Card className="mt-5 border-warning/40">
          <CardHeader><CardTitle className="flex items-center gap-2"><HandCoins className="size-4 text-warning" /> Concluídos sem pagamento ({pending.length})</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {pending.slice(0, 8).map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="w-28 text-muted">{formatDate(a.start)} {formatTime(a.start)}</span>
                  <span className="min-w-0 flex-1 truncate">{customers.get(a.customerId)?.name} · {services.get(a.serviceId)?.name}</span>
                  <span className="font-semibold tabular-nums">{money(a.priceCents)}</span>
                  <Button size="sm" variant="soft" onClick={() => setPayment({ title: `${customers.get(a.customerId)?.name} · ${services.get(a.serviceId)?.name}`, amountCents: a.priceCents, appointmentId: a.id, customerId: a.customerId, professionalId: a.professionalId })}>
                    Receber
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Recebimentos</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {payments.length === 0 && <li className="py-4 text-center text-muted">Nenhum recebimento no período.</li>}
              {payments.slice(0, 50).map((x) => (
                <li key={x.id} className="flex items-center gap-3 py-2">
                  <span className="w-24 shrink-0 text-muted tabular-nums">{p.key === "hoje" ? formatTime(x.paidAt) : formatDate(x.paidAt)}</span>
                  <span className="min-w-0 flex-1 truncate">{x.customerId ? customers.get(x.customerId)?.name : "Avulso"}</span>
                  <span className="hidden text-muted sm:inline">{paymentMethodLabel[x.method]}</span>
                  <span className="w-24 text-right font-semibold tabular-nums">{money(x.amountCents)}</span>
                </li>
              ))}
            </ul>
            {payments.length > 50 && <p className="mt-2 text-xs text-muted">Mostrando 50 de {payments.length}. Exporte o CSV para ver todos.</p>}
          </CardContent>
        </Card>
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Comissões</CardTitle>
              <Button size="sm" variant="ghost" onClick={exportCommissions}><Download /> CSV</Button>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr><th className="py-2 font-semibold">Profissional</th><th className="py-2 text-right font-semibold">Faturado</th><th className="py-2 text-right font-semibold">Comissão</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {commissions.map((c) => (
                    <tr key={c.pro.id}>
                      <td className="py-2">{c.pro.name} <span className="text-muted">({c.pro.commissionPct}%)</span></td>
                      <td className="py-2 text-right text-muted tabular-nums">{money(c.gross)}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{money(c.commission)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border font-semibold">
                    <td className="py-2">Total</td>
                    <td className="py-2 text-right tabular-nums">{money(commissions.reduce((s, c) => s + c.gross, 0))}</td>
                    <td className="py-2 text-right tabular-nums">{money(commissions.reduce((s, c) => s + c.commission, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
      <PaymentDialog target={payment} onClose={() => setPayment(null)} />
      <LoosePaymentDialog open={loose} onClose={() => setLoose(false)} onPick={(t) => { setLoose(false); setPayment(t); }} />
    </div>
  );
}

/** Recebimento avulso: escolhe cliente e profissional antes de informar o valor. */
function LoosePaymentDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (t: PaymentTarget) => void }) {
  const { state } = useStore();
  const [customerId, setCustomerId] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Registrar recebimento"
      description="Para vendas de produtos, pacotes ou atendimentos fora da agenda."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onPick({ title: state.customers.find((c) => c.id === customerId)?.name ?? "Recebimento avulso", amountCents: 0, customerId: customerId || undefined, professionalId: professionalId || undefined })}>
            Continuar
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="Cliente (opcional)">
          {(id) => (
            <Select id={id} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Sem cliente</option>
              {[...state.customers].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Profissional (para comissão)">
          {(id) => (
            <Select id={id} value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              <option value="">Nenhum</option>
              {state.professionals.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          )}
        </Field>
      </div>
    </Dialog>
  );
}
