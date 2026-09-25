"use client";

import { Check, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { formatDuration, money } from "@/lib/format";
import { newId, useLookups, useStore } from "@/lib/store";
import type { Service, ServiceColor } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLORS: { value: ServiceColor; label: string }[] = [
  { value: "lavanda", label: "Lavanda" },
  { value: "ceu", label: "Céu" },
  { value: "menta", label: "Menta" },
  { value: "pessego", label: "Pêssego" },
  { value: "rosa", label: "Rosa" },
  { value: "areia", label: "Areia" },
];
const DURATIONS = [10, 15, 20, 30, 40, 45, 60, 75, 90, 120, 150, 180, 240, 300, 360, 480];

export default function ServicosPage() {
  const { state } = useStore();
  const { currentUser } = useLookups();
  const [editing, setEditing] = useState<Service | null | undefined>(undefined);
  const isAdmin = currentUser.role === "admin";
  const list = [...state.services].sort((a, b) => Number(b.active) - Number(a.active) || a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  return (
    <div>
      <PageHeader
        title="Serviços"
        description={`${state.services.filter((s) => s.active).length} serviços ativos`}
        actions={isAdmin && <Button onClick={() => setEditing(null)}><Plus /> Novo serviço</Button>}
      />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-border">
              <th className="px-4 py-3 font-semibold">Serviço</th>
              <th className="px-4 py-3 font-semibold">Categoria</th>
              <th className="px-4 py-3 font-semibold">Duração</th>
              <th className="px-4 py-3 font-semibold">Preço</th>
              <th className="px-4 py-3 font-semibold">Profissionais</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} className={cn("border-b border-border/70 last:border-0", !s.active && "opacity-60")}>
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2.5 font-semibold">
                    <span className={cn("svc size-4 rounded", `svc-${s.color}`)} aria-hidden /> {s.name}
                    {!s.active && <Badge>Inativo</Badge>}
                  </span>
                </td>
                <td className="px-4 py-2 text-muted">{s.category}</td>
                <td className="px-4 py-2">{formatDuration(s.durationMin)}</td>
                <td className="px-4 py-2 tabular-nums">{money(s.priceCents)}</td>
                <td className="px-4 py-2 text-muted">
                  {state.professionals.filter((p) => p.active && p.serviceIds.includes(s.id)).map((p) => p.name.split(" ")[0]).join(", ") || "Nenhum"}
                </td>
                <td className="px-4 py-2 text-right">
                  {isAdmin && <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>Editar</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <ServiceDialog open={editing !== undefined} service={editing ?? undefined} onClose={() => setEditing(undefined)} />
    </div>
  );
}

function ServiceDialog({ open, service, onClose }: { open: boolean; service?: Service; onClose: () => void }) {
  const { state, db, toast } = useStore();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState("0,00");
  const [color, setColor] = useState<ServiceColor>("menta");
  const [active, setActive] = useState(true);
  const [pros, setPros] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(service?.name ?? "");
    setCategory(service?.category ?? "Geral");
    setDuration(service?.durationMin ?? 30);
    setPrice(((service?.priceCents ?? 0) / 100).toFixed(2).replace(".", ","));
    setColor(service?.color ?? "menta");
    setActive(service?.active ?? true);
    setPros(service ? state.professionals.filter((p) => p.serviceIds.includes(service.id)).map((p) => p.id) : state.professionals.filter((p) => p.active).map((p) => p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, service]);

  const save = async () => {
    if (!name.trim()) return toast("Informe o nome do serviço.", "erro");
    const cents = Math.round(Number(price.replace(/\./g, "").replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 0) return toast("Preço inválido.", "erro");
    const item: Service = {
      id: service?.id ?? newId(),
      name: name.trim(),
      category: category.trim() || "Geral",
      durationMin: duration,
      priceCents: cents,
      color,
      active,
    };
    setSaving(true);
    let ok = await db.upsert("services", [item]);
    // Atualiza quem realiza o serviço.
    const changed = state.professionals
      .filter((p) => pros.includes(p.id) !== p.serviceIds.includes(item.id))
      .map((p) => ({ ...p, serviceIds: pros.includes(p.id) ? [...p.serviceIds, item.id] : p.serviceIds.filter((x) => x !== item.id) }));
    if (ok && changed.length) ok = await db.upsert("professionals", changed);
    setSaving(false);
    if (!ok) return;
    toast(service ? "Serviço atualizado." : "Serviço cadastrado.", "sucesso");
    onClose();
  };

  const categories = [...new Set(state.services.map((s) => s.category))];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={service ? "Editar serviço" : "Novo serviço"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" className="sm:col-span-2">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Categoria">
          {(id) => (
            <>
              <Input id={id} list="categorias" value={category} onChange={(e) => setCategory(e.target.value)} />
              <datalist id="categorias">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </>
          )}
        </Field>
        <Field label="Duração">
          {(id) => (
            <Select id={id} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {[...new Set([...DURATIONS, duration])].sort((a, b) => a - b).map((m) => <option key={m} value={m}>{formatDuration(m)}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Preço (R$)">{(id) => <Input id={id} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />}</Field>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold">Cor na agenda</legend>
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((c) => (
              <button key={c.value} type="button" aria-label={c.label} aria-pressed={color === c.value} onClick={() => setColor(c.value)}
                className={cn("svc grid size-11 place-items-center rounded-xl", `svc-${c.value}`, color === c.value && "ring-2 ring-text")}>
                {color === c.value && <Check className="size-4" />}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-[13px] font-semibold">Profissionais habilitados</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {state.professionals.filter((p) => p.active).map((p) => (
              <label key={p.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={pros.includes(p.id)} onChange={(e) => setPros(e.target.checked ? [...pros, p.id] : pros.filter((x) => x !== p.id))} />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium sm:col-span-2">
          <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Ativo (desative para esconder sem perder o histórico)
        </label>
      </div>
    </Dialog>
  );
}
