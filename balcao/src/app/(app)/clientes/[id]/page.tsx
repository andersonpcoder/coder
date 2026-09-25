"use client";

import { ArrowLeft, CalendarPlus, FileDown, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AppointmentDialog, type AppointmentDialogSeed } from "@/components/agenda/appointment-dialog";
import { CustomerDialog } from "@/components/clientes/customer-dialog";
import { ChannelIcon, StatusBadge } from "@/components/shared/status";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { downloadFile } from "@/lib/csv";
import { channelLabel, formatDate, formatPhone, formatTime, money, paymentMethodLabel } from "@/lib/format";
import { errorMessage } from "@/lib/supabase/client";
import { useLookups, useStore } from "@/lib/store";

export default function ClientePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { state, dispatch, supabase, toast } = useStore();
  const { services, professionals, currentUser } = useLookups();
  const [editing, setEditing] = useState(false);
  const [schedule, setSchedule] = useState<AppointmentDialogSeed | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const customer = state.customers.find((c) => c.id === id);
  const canManage = currentUser.role !== "profissional";
  const isAdmin = currentUser.role === "admin";

  if (!customer) {
    return (
      <div className="py-20 text-center">
        <p className="text-lg font-semibold">Cliente não encontrado</p>
        <Button asChild variant="outline" className="mt-4"><Link href="/clientes">Voltar para clientes</Link></Button>
      </div>
    );
  }

  const appts = state.appointments.filter((a) => a.customerId === id).sort((a, b) => b.start.localeCompare(a.start));
  const payments = state.payments.filter((p) => p.customerId === id).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  const conversations = state.conversations.filter((c) => c.customerId === id);
  const visits = appts.filter((a) => a.status === "concluido").length;
  const noShows = appts.filter((a) => a.status === "faltou").length;
  const spent = payments.reduce((s, p) => s + p.amountCents, 0);

  // LGPD: portabilidade (exportar) e eliminação (excluir) dos dados do titular.
  const exportData = async () => {
    let data: unknown;
    if (supabase) {
      const res = await supabase.rpc("export_customer_data", { p_customer: id });
      if (res.error) return toast(errorMessage(res.error), "erro");
      data = res.data;
    } else {
      data = { cliente: customer, agendamentos: appts, pagamentos: payments, mensagens: conversations.flatMap((c) => c.messages) };
    }
    downloadFile(`dados-${customer.name.toLowerCase().replace(/\s+/g, "-")}.json`, JSON.stringify(data, null, 2), "application/json");
  };

  const deleteData = async () => {
    setBusy(true);
    if (supabase) {
      const { error } = await supabase.rpc("delete_customer_data", { p_customer: id });
      if (error) {
        setBusy(false);
        return toast(errorMessage(error), "erro");
      }
    }
    dispatch({ type: "remove", collection: "appointments", ids: appts.map((a) => a.id) });
    dispatch({ type: "remove", collection: "conversations", ids: conversations.map((c) => c.id) });
    for (const p of payments) dispatch({ type: "patch", collection: "payments", id: p.id, patch: { customerId: undefined } });
    dispatch({ type: "remove", collection: "customers", ids: [id] });
    toast("Dados do cliente excluídos.", "sucesso");
    router.replace("/clientes");
  };

  return (
    <div>
      <Button variant="ghost" asChild className="-ml-3 mb-2"><Link href="/clientes"><ArrowLeft /> Clientes</Link></Button>
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <Avatar name={customer.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold sm:text-3xl">{customer.name}</h1>
          <p className="text-sm text-muted">
            {customer.phone ? formatPhone(customer.phone) : "Sem telefone"}
            {customer.email && ` · ${customer.email}`}
            {customer.birthDate && ` · nasceu em ${formatDate(`${customer.birthDate}T12:00:00`)}`}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">{customer.tags.map((t) => <Badge key={t} tone="primary">{t}</Badge>)}</div>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setSchedule({ customerId: id })}><CalendarPlus /> Agendar</Button>
            <Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Editar</Button>
          </div>
        )}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Visitas", String(visits)], ["Faltas", String(noShows)], ["Total gasto", money(spent)], ["Cliente desde", formatDate(customer.createdAt)]].map(([l, v]) => (
          <Card key={l} className="p-4"><div className="text-[13px] text-muted">{l}</div><div className="mt-1 font-display text-xl font-semibold">{v}</div></Card>
        ))}
      </div>

      {customer.notes && <p className="mb-5 rounded-2xl bg-accent-soft px-4 py-3 text-sm"><strong>Observações:</strong> {customer.notes}</p>}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Agendamentos ({appts.length})</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {appts.length === 0 && <li className="py-4 text-muted">Nenhum agendamento.</li>}
              {appts.slice(0, 30).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block font-medium">{services.get(a.serviceId)?.name}</span>
                    <span className="block text-xs text-muted">{formatDate(a.start)} às {formatTime(a.start)} · {professionals.get(a.professionalId)?.name}</span>
                  </span>
                  <StatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-5">
          {canManage && (
            <Card>
              <CardHeader><CardTitle>Pagamentos</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y divide-border text-sm">
                  {payments.length === 0 && <li className="py-4 text-muted">Nenhum pagamento.</li>}
                  {payments.slice(0, 20).map((p) => (
                    <li key={p.id} className="flex justify-between gap-2 py-2">
                      <span>{formatDate(p.paidAt)} · {paymentMethodLabel[p.method]}</span>
                      <span className="font-semibold tabular-nums">{money(p.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {canManage && (
            <Card>
              <CardHeader><CardTitle>Conversas</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y divide-border text-sm">
                  {conversations.length === 0 && <li className="py-4 text-muted">Nenhuma conversa.</li>}
                  {conversations.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 py-2">
                      <ChannelIcon channel={c.channel} />
                      <span className="flex-1 truncate">{c.messages[c.messages.length - 1]?.body ?? channelLabel[c.channel]}</span>
                      <Badge tone={c.status === "aberta" ? "accent" : "neutral"}>{c.status === "aberta" ? "Aberta" : "Resolvida"}</Badge>
                    </li>
                  ))}
                </ul>
                <Link href="/atendimentos" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary">Abrir atendimentos</Link>
              </CardContent>
            </Card>
          )}
          {isAdmin && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-primary" /> Privacidade (LGPD)</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p className="text-muted">
                  {customer.lgpdConsentAt ? `Consentimento registrado em ${formatDate(customer.lgpdConsentAt)}.` : "Sem consentimento registrado pela página de agendamento."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={exportData}><FileDown /> Exportar dados</Button>
                  <Button variant="danger" onClick={() => setDeleting(true)}><Trash2 /> Excluir dados</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <CustomerDialog open={editing} customer={customer} onClose={() => setEditing(false)} />
      <AppointmentDialog seed={schedule} onClose={() => setSchedule(null)} />
      <ConfirmDialog
        open={deleting}
        title={`Excluir os dados de ${customer.name}?`}
        confirmLabel="Excluir definitivamente"
        danger
        busy={busy}
        onConfirm={deleteData}
        onClose={() => setDeleting(false)}
      >
        <p className="text-sm text-muted">
          Remove o cadastro, os agendamentos e as conversas. Os pagamentos ficam para fins fiscais, sem ligação com a pessoa. Não dá para desfazer.
        </p>
      </ConfirmDialog>
    </div>
  );
}
