"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { newId, useStore } from "@/lib/store";
import type { Customer } from "@/lib/types";

/** Cadastro e edição de cliente. */
export function CustomerDialog({
  open,
  customer,
  onClose,
  onSaved,
}: {
  open: boolean;
  customer?: Customer;
  onClose: () => void;
  onSaved?: (c: Customer) => void;
}) {
  const { state, db, toast } = useStore();
  const [form, setForm] = useState({ name: "", phone: "", email: "", birthDate: "", tags: "", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: customer?.name ?? "",
      phone: customer?.phone ?? "",
      email: customer?.email ?? "",
      birthDate: customer?.birthDate ?? "",
      tags: customer?.tags.join(", ") ?? "",
      notes: customer?.notes ?? "",
    });
  }, [open, customer]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const phone = form.phone.replace(/\D/g, "");
    if (!form.name.trim()) return toast("Informe o nome.", "erro");
    if (phone && state.customers.some((c) => c.phone === phone && c.id !== customer?.id)) {
      return toast("Já existe um cliente com este telefone.", "erro");
    }
    const item: Customer = {
      id: customer?.id ?? newId(),
      name: form.name.trim(),
      phone,
      email: form.email.trim() || undefined,
      birthDate: form.birthDate || undefined,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      notes: form.notes.trim() || undefined,
      createdAt: customer?.createdAt ?? new Date().toISOString(),
      lgpdConsentAt: customer?.lgpdConsentAt,
    };
    setSaving(true);
    const ok = customer
      ? await db.patch("customers", item.id, { name: item.name, phone: item.phone || undefined, email: item.email, birthDate: item.birthDate, tags: item.tags, notes: item.notes })
      : await db.upsert("customers", [item]);
    setSaving(false);
    if (!ok) return;
    toast(customer ? "Cliente atualizado." : "Cliente cadastrado.", "sucesso");
    onSaved?.(item);
    onClose();
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={customer ? "Editar cliente" : "Novo cliente"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => submit()} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" className="sm:col-span-2">{(id) => <Input id={id} autoFocus value={form.name} onChange={set("name")} />}</Field>
        <Field label="WhatsApp">{(id) => <Input id={id} type="tel" inputMode="tel" placeholder="(11) 90000-0000" value={form.phone} onChange={set("phone")} />}</Field>
        <Field label="E-mail">{(id) => <Input id={id} type="email" value={form.email} onChange={set("email")} />}</Field>
        <Field label="Data de nascimento">{(id) => <Input id={id} type="date" value={form.birthDate} onChange={set("birthDate")} />}</Field>
        <Field label="Etiquetas" hint="Separe por vírgula. Ex.: VIP, Mensalista">{(id) => <Input id={id} value={form.tags} onChange={set("tags")} />}</Field>
        <Field label="Observações" className="sm:col-span-2">{(id) => <Textarea id={id} value={form.notes} onChange={set("notes")} placeholder="Alergias, preferências…" />}</Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
