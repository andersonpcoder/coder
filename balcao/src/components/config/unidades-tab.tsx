"use client";

import { Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { isValidHours, WeekHoursEditor } from "@/components/shared/week-hours";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { formatAddress } from "@/lib/db/mappers";
import { formatPhone } from "@/lib/format";
import { hasFeature } from "@/lib/plans";
import { newId, useStore } from "@/lib/store";
import type { Unit } from "@/lib/types";

export function UnidadesTab() {
  const { state, toast } = useStore();
  const [editing, setEditing] = useState<Unit | null | undefined>(undefined);
  const canAdd = hasFeature(state.subscription, "unidades");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Endereço, telefone e horário de funcionamento de cada unidade.</p>
        <Button onClick={() => (canAdd ? setEditing(null) : toast("Várias unidades estão disponíveis no plano Empresa.", "erro"))}><Plus /> Nova unidade</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {state.units.map((u, i) => (
          <Card key={u.id} className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-semibold">{u.name} {i === 0 && <span className="text-xs font-normal text-muted">(principal)</span>}</h3>
                <p className="text-sm text-muted">{formatAddress(u) || "Sem endereço"}</p>
                {u.phone && <p className="text-sm text-muted">{formatPhone(u.phone)}</p>}
              </div>
              <Button variant="outline" size="sm" onClick={() => setEditing(u)}><Pencil /> Editar</Button>
            </div>
          </Card>
        ))}
      </div>
      <UnitDialog open={editing !== undefined} unit={editing ?? undefined} onClose={() => setEditing(undefined)} />
    </div>
  );
}

function UnitDialog({ open, unit, onClose }: { open: boolean; unit?: Unit; onClose: () => void }) {
  const { state, db, dispatch, toast } = useStore();
  const [form, setForm] = useState<Unit>({ id: "", name: "", businessHours: {} });
  useEffect(() => {
    if (open) setForm(unit ?? { id: newId(), name: "", businessHours: state.units[0]?.businessHours ?? {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unit]);

  const save = async () => {
    if (!form.name.trim()) return toast("Informe o nome da unidade.", "erro");
    if (!isValidHours(form.businessHours)) return toast("Confira os horários.", "erro");
    const item = { ...form, name: form.name.trim(), phone: form.phone?.replace(/\D/g, "") || undefined };
    if (!(await db.upsert("units", [item]))) return;
    if (state.units[0]?.id === item.id || !state.units.length) {
      dispatch({ type: "patchCompany", patch: { address: formatAddress(item), phone: item.phone ?? "" } });
    }
    toast("Unidade salva.", "sucesso");
    onClose();
  };

  const set = (k: keyof Unit) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()} title={unit ? "Editar unidade" : "Nova unidade"} className="sm:max-w-2xl"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={save}>Salvar</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome">{(id) => <Input id={id} value={form.name} onChange={set("name")} />}</Field>
        <Field label="Telefone / WhatsApp">{(id) => <Input id={id} type="tel" value={form.phone ?? ""} onChange={set("phone")} />}</Field>
        <Field label="Endereço" className="sm:col-span-2">{(id) => <Input id={id} value={form.addressLine ?? ""} onChange={set("addressLine")} />}</Field>
        <div className="grid grid-cols-[1fr_80px_120px] gap-3 sm:col-span-2">
          <Field label="Cidade">{(id) => <Input id={id} value={form.city ?? ""} onChange={set("city")} />}</Field>
          <Field label="UF">{(id) => <Input id={id} maxLength={2} value={form.state ?? ""} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} />}</Field>
          <Field label="CEP">{(id) => <Input id={id} value={form.postalCode ?? ""} onChange={set("postalCode")} />}</Field>
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-[13px] font-semibold">Horário de funcionamento</legend>
          <WeekHoursEditor value={form.businessHours} onChange={(businessHours) => setForm({ ...form, businessHours })} />
        </fieldset>
      </div>
    </Dialog>
  );
}
