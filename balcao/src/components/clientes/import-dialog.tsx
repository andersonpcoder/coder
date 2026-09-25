"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { normalizeHeader, parseBrDate, parseCsv } from "@/lib/csv";
import { newId, useStore } from "@/lib/store";
import type { Customer } from "@/lib/types";

const COLUMNS: Record<string, keyof Customer> = {
  nome: "name", name: "name", cliente: "name",
  telefone: "phone", whatsapp: "phone", celular: "phone", phone: "phone", fone: "phone",
  email: "email",
  nascimento: "birthDate", datadenascimento: "birthDate", aniversario: "birthDate",
  etiquetas: "tags", tags: "tags",
  observacoes: "notes", observacao: "notes", notas: "notes", obs: "notes",
};

/** Importa clientes de planilha CSV. Telefones já cadastrados são ignorados. */
export function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, db, toast } = useStore();
  const [parsed, setParsed] = useState<Customer[] | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const read = async (file: File) => {
    setError("");
    const text = await file.text();
    const { header, rows } = parseCsv(text);
    const map = header.map((h) => COLUMNS[normalizeHeader(h)]);
    if (!map.includes("name")) {
      setParsed(null);
      setError("A planilha precisa de uma coluna \"nome\". Colunas aceitas: nome, telefone, email, nascimento, etiquetas, observacoes.");
      return;
    }
    const existing = new Set(state.customers.map((c) => c.phone).filter(Boolean));
    const seen = new Set<string>();
    const list: Customer[] = [];
    let dup = 0;
    for (const r of rows) {
      const rec: Record<string, string> = {};
      map.forEach((k, i) => k && (rec[k] = (r[i] ?? "").trim()));
      if (!rec.name) continue;
      const phone = (rec.phone ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
      if (phone && (existing.has(phone) || seen.has(phone))) {
        dup++;
        continue;
      }
      if (phone) seen.add(phone);
      list.push({
        id: newId(),
        name: rec.name,
        phone,
        email: rec.email || undefined,
        birthDate: rec.birthDate ? parseBrDate(rec.birthDate) : undefined,
        tags: (rec.tags ?? "").split(/[,|]/).map((t) => t.trim()).filter(Boolean),
        notes: rec.notes || undefined,
        createdAt: new Date().toISOString(),
      });
    }
    setSkipped(dup);
    setParsed(list);
  };

  const save = async () => {
    if (!parsed?.length) return;
    setSaving(true);
    let ok = true;
    for (let i = 0; i < parsed.length && ok; i += 500) ok = await db.upsert("customers", parsed.slice(i, i + 500));
    setSaving(false);
    if (!ok) return;
    toast(`${parsed.length} clientes importados${skipped ? `; ${skipped} ignorados por telefone repetido` : ""}.`, "sucesso");
    setParsed(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Importar clientes"
      description="Planilha CSV (separada por ; ou ,) com colunas nome, telefone, email, nascimento, etiquetas e observacoes."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!parsed?.length || saving}>
            {saving ? "Importando…" : parsed ? `Importar ${parsed.length}` : "Importar"}
          </Button>
        </>
      }
    >
      <Field label="Arquivo CSV">
        {(id) => <Input id={id} type="file" accept=".csv,text/csv" className="py-2" onChange={(e) => e.target.files?.[0] && read(e.target.files[0])} />}
      </Field>
      {error && <p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
      {parsed && (
        <div className="mt-4 text-sm" role="status">
          <p><strong>{parsed.length}</strong> clientes novos{skipped ? `, ${skipped} já cadastrados serão ignorados` : ""}.</p>
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
            {parsed.slice(0, 5).map((c) => (
              <li key={c.id} className="flex justify-between gap-2 px-3 py-2"><span>{c.name}</span><span className="text-muted">{c.phone}</span></li>
            ))}
          </ul>
          {parsed.length > 5 && <p className="mt-1 text-muted">e mais {parsed.length - 5}…</p>}
        </div>
      )}
    </Dialog>
  );
}
