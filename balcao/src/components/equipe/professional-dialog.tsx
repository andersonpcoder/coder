"use client";

import { Copy, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import { isValidHours, WeekHoursEditor } from "@/components/shared/week-hours";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { PLANS, effectivePlan } from "@/lib/plans";
import { newId, useLookups, useStore } from "@/lib/store";
import type { Professional, WorkHours } from "@/lib/types";
import { createInvite } from "./invite";

export function ProfessionalDialog({ open, professional, onClose }: { open: boolean; professional?: Professional; onClose: () => void }) {
  const { state, db, toast } = useStore();
  const { currentUser } = useLookups();
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [commission, setCommission] = useState("0");
  const [unitId, setUnitId] = useState("");
  const [active, setActive] = useState(true);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [hours, setHours] = useState<WorkHours>({});
  const [inviteLink, setInviteLink] = useState("");
  const [saving, setSaving] = useState(false);
  const isAdmin = currentUser.role === "admin";

  useEffect(() => {
    if (!open) return;
    setName(professional?.name ?? "");
    setTitle(professional?.title ?? "");
    setCommission(String(professional?.commissionPct ?? 0));
    setUnitId(professional?.unitId ?? "");
    setActive(professional?.active ?? true);
    setServiceIds(professional?.serviceIds ?? state.services.filter((s) => s.active).map((s) => s.id));
    setHours(professional?.workHours ?? state.units[0]?.businessHours ?? {});
    setInviteLink("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, professional]);

  const plan = PLANS[effectivePlan(state.subscription)];
  const activeCount = state.professionals.filter((p) => p.active && p.id !== professional?.id).length;

  const save = async () => {
    if (!name.trim()) return toast("Informe o nome.", "erro");
    if (!isValidHours(hours)) return toast("Confira os horários: o fim precisa ser depois do início.", "erro");
    if (active && plan.maxProfessionals !== null && activeCount >= plan.maxProfessionals) {
      return toast(`O plano ${plan.name} permite até ${plan.maxProfessionals} profissional(is) ativo(s). Faça upgrade em Configurações > Plano.`, "erro");
    }
    const pct = Math.min(100, Math.max(0, Number(commission.replace(",", ".")) || 0));
    const item: Professional = {
      id: professional?.id ?? newId(),
      name: name.trim(),
      title: title.trim(),
      avatarHue: professional?.avatarHue ?? Math.floor(Math.random() * 360),
      commissionPct: pct,
      serviceIds,
      workHours: hours,
      active,
      unitId: unitId || undefined,
      userId: professional?.userId,
    };
    setSaving(true);
    const ok = await db.upsert("professionals", [item]);
    setSaving(false);
    if (!ok) return;
    toast(professional ? "Profissional atualizado." : "Profissional cadastrado.", "sucesso");
    onClose();
  };

  const invite = async () => {
    if (!professional) return;
    const created = await createInvite(db, "profissional", { professionalId: professional.id });
    if (created) setInviteLink(created.link);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={professional ? `Editar ${professional.name}` : "Novo profissional"}
      className="sm:max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          {isAdmin && <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>}
        </>
      }
    >
      <fieldset disabled={!isAdmin} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Função">{(id) => <Input id={id} placeholder="Ex.: Barbeiro" value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <Field label="Comissão (%)">{(id) => <Input id={id} inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} />}</Field>
        {state.units.length > 1 ? (
          <Field label="Unidade">
            {(id) => (
              <Select id={id} value={unitId} onChange={(e) => setUnitId(e.target.value)}>
                <option value="">Todas</option>
                {state.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            )}
          </Field>
        ) : <span />}
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium sm:col-span-2">
          <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Ativo (aparece na agenda e na página de agendamento)
        </label>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-[13px] font-semibold">Serviços que realiza</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {state.services.filter((s) => s.active).map((s) => (
              <label key={s.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--primary)]"
                  checked={serviceIds.includes(s.id)}
                  onChange={(e) => setServiceIds(e.target.checked ? [...serviceIds, s.id] : serviceIds.filter((x) => x !== s.id))}
                />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="sm:col-span-2">
          <legend className="mb-2 text-[13px] font-semibold">Horário de trabalho</legend>
          <WeekHoursEditor value={hours} onChange={setHours} />
        </fieldset>
      </fieldset>
      {isAdmin && professional && (
        <div className="mt-5 rounded-2xl bg-surface-2 p-4 text-sm">
          <p className="font-semibold">Acesso ao Balcão</p>
          {professional.userId ? (
            <p className="mt-1 text-muted">Já tem acesso e vê a própria agenda.</p>
          ) : inviteLink ? (
            <div className="mt-2 flex gap-2">
              <Input readOnly value={inviteLink} aria-label="Link do convite" onFocus={(e) => e.target.select()} />
              <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(inviteLink); toast("Link copiado.", "sucesso"); }}><Copy /> Copiar</Button>
            </div>
          ) : (
            <>
              <p className="mt-1 text-muted">Gere um link para {professional.name.split(" ")[0]} criar a conta e ver a própria agenda.</p>
              <Button variant="outline" className="mt-2" onClick={invite}><Link2 /> Gerar convite</Button>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
