"use client";

import { Download, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { NextPhase } from "@/components/shell/next-phase";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { formatDate, formatPhone } from "@/lib/format";
import { useLookups, useStore } from "@/lib/store";

export default function ClientesPage() {
  const { state } = useStore();
  const { currentUser } = useLookups();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const mine = currentUser.role === "profissional"
      ? new Set(state.appointments.filter((a) => a.professionalId === currentUser.professionalId).map((a) => a.customerId))
      : null;
    const term = q.trim().toLowerCase();
    return state.customers
      .filter((c) => !mine || mine.has(c.id))
      .filter((c) => !term || c.name.toLowerCase().includes(term) || c.phone.includes(term.replace(/\D/g, "") || "§") || c.tags.some((t) => t.toLowerCase().includes(term)))
      .map((c) => {
        const appts = state.appointments.filter((a) => a.customerId === c.id && new Date(a.start) <= new Date());
        const last = appts.sort((a, b) => b.start.localeCompare(a.start))[0];
        return { c, visits: appts.filter((a) => a.status === "concluido").length, noShows: appts.filter((a) => a.status === "faltou").length, last };
      })
      .sort((a, b) => a.c.name.localeCompare(b.c.name, "pt-BR"));
  }, [state.customers, state.appointments, q, currentUser]);

  const exportCsv = () => {
    const header = "nome;telefone;email;nascimento;etiquetas;visitas;faltas";
    const lines = rows.map(({ c, visits, noShows }) =>
      [c.name, c.phone, c.email ?? "", c.birthDate ? formatDate(`${c.birthDate}T12:00:00`) : "", c.tags.join(","), visits, noShows]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";"),
    );
    // BOM para o Excel abrir acentos corretamente.
    const blob = new Blob(["﻿" + [header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "clientes-balcao.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <PageHeader
        title="Clientes"
        description={`${rows.length} clientes`}
        actions={<Button variant="outline" onClick={exportCsv}><Download /> Exportar CSV</Button>}
      />
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input aria-label="Buscar clientes" placeholder="Nome, telefone ou etiqueta" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-border">
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">WhatsApp</th>
              <th className="px-4 py-3 font-semibold">Etiquetas</th>
              <th className="px-4 py-3 font-semibold">Visitas</th>
              <th className="px-4 py-3 font-semibold">Faltas</th>
              <th className="px-4 py-3 font-semibold">Última visita</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, visits, noShows, last }) => (
              <tr key={c.id} className="border-b border-border/70 last:border-0">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2.5"><Avatar name={c.name} size="sm" /> <span className="font-semibold">{c.name}</span></span>
                </td>
                <td className="px-4 py-2.5 tabular-nums">{formatPhone(c.phone)}</td>
                <td className="px-4 py-2.5"><span className="flex flex-wrap gap-1">{c.tags.map((t) => <Badge key={t} tone="primary">{t}</Badge>)}</span></td>
                <td className="px-4 py-2.5 tabular-nums">{visits}</td>
                <td className="px-4 py-2.5 tabular-nums">{noShows}</td>
                <td className="px-4 py-2.5 text-muted">{last ? formatDate(last.start) : "Nunca"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <NextPhase items={["Ficha completa com histórico de pagamentos e conversas", "Importar planilha CSV", "LGPD: exportar e excluir dados do cliente (funções já criadas no banco)"]} />
    </div>
  );
}
