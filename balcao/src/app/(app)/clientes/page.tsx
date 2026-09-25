"use client";

import { Download, Plus, Search, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CustomerDialog } from "@/components/clientes/customer-dialog";
import { ImportDialog } from "@/components/clientes/import-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { downloadFile, toCsv } from "@/lib/csv";
import { formatDate, formatPhone } from "@/lib/format";
import { useLookups, useStore } from "@/lib/store";

export default function ClientesPage() {
  const { state } = useStore();
  const { currentUser } = useLookups();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const isPro = currentUser.role === "profissional";

  const stats = useMemo(() => {
    const now = new Date();
    const map = new Map<string, { visits: number; noShows: number; last?: string; next?: string }>();
    for (const a of state.appointments) {
      const s = map.get(a.customerId) ?? { visits: 0, noShows: 0 };
      if (a.status === "concluido") s.visits++;
      if (a.status === "faltou") s.noShows++;
      if (new Date(a.start) <= now && a.status === "concluido" && (!s.last || a.start > s.last)) s.last = a.start;
      if (new Date(a.start) > now && ["agendado", "confirmado"].includes(a.status) && (!s.next || a.start < s.next)) s.next = a.start;
      map.set(a.customerId, s);
    }
    return map;
  }, [state.appointments]);

  const allTags = useMemo(() => [...new Set(state.customers.flatMap((c) => c.tags))].sort(), [state.customers]);

  const rows = useMemo(() => {
    const mine = isPro
      ? new Set(state.appointments.filter((a) => a.professionalId === currentUser.professionalId).map((a) => a.customerId))
      : null;
    const term = q.trim().toLowerCase();
    const digits = term.replace(/\D/g, "");
    return state.customers
      .filter((c) => !mine || mine.has(c.id))
      .filter((c) => !tag || c.tags.includes(tag))
      .filter((c) => !term || c.name.toLowerCase().includes(term) || (digits && c.phone.includes(digits)) || c.email?.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [state.customers, state.appointments, q, tag, isPro, currentUser.professionalId]);

  const exportCsv = () => {
    downloadFile(
      "clientes-balcao.csv",
      toCsv(
        ["nome", "telefone", "email", "nascimento", "etiquetas", "observacoes", "visitas", "faltas", "ultima_visita"],
        rows.map((c) => {
          const s = stats.get(c.id);
          return [c.name, c.phone, c.email, c.birthDate ? formatDate(`${c.birthDate}T12:00:00`) : "", c.tags.join(","), c.notes, s?.visits ?? 0, s?.noShows ?? 0, s?.last ? formatDate(s.last) : ""];
        }),
      ),
    );
  };

  return (
    <div>
      <PageHeader
        title="Clientes"
        description={`${rows.length} clientes`}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}><Download /> Exportar CSV</Button>
            {!isPro && (
              <>
                <Button variant="outline" onClick={() => setImporting(true)}><Upload /> Importar CSV</Button>
                <Button onClick={() => setCreating(true)}><Plus /> Novo cliente</Button>
              </>
            )}
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Buscar clientes" placeholder="Nome, telefone ou e-mail" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select aria-label="Filtrar por etiqueta" value={tag} onChange={(e) => setTag(e.target.value)} className="w-auto">
          <option value="">Todas as etiquetas</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-border">
              <th className="px-4 py-3 font-semibold">Cliente</th>
              <th className="px-4 py-3 font-semibold">WhatsApp</th>
              <th className="px-4 py-3 font-semibold">Etiquetas</th>
              <th className="px-4 py-3 font-semibold">Visitas</th>
              <th className="px-4 py-3 font-semibold">Faltas</th>
              <th className="px-4 py-3 font-semibold">Última visita</th>
              <th className="px-4 py-3 font-semibold">Próximo horário</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">Nenhum cliente encontrado.</td></tr>
            )}
            {rows.map((c) => {
              const s = stats.get(c.id);
              return (
                <tr key={c.id} className="border-b border-border/70 last:border-0 hover:bg-surface-2/60">
                  <td className="px-4 py-2">
                    <Link href={`/clientes/${c.id}`} className="flex min-h-11 items-center gap-2.5 font-semibold hover:text-primary">
                      <Avatar name={c.name} size="sm" /> {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 tabular-nums">{c.phone ? formatPhone(c.phone) : "Sem telefone"}</td>
                  <td className="px-4 py-2"><span className="flex flex-wrap gap-1">{c.tags.map((t) => <Badge key={t} tone="primary">{t}</Badge>)}</span></td>
                  <td className="px-4 py-2 tabular-nums">{s?.visits ?? 0}</td>
                  <td className="px-4 py-2 tabular-nums">{s?.noShows ?? 0}</td>
                  <td className="px-4 py-2 text-muted">{s?.last ? formatDate(s.last) : "Nunca"}</td>
                  <td className="px-4 py-2 text-muted">{s?.next ? formatDate(s.next) : "Nenhum"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <CustomerDialog open={creating} onClose={() => setCreating(false)} />
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}
