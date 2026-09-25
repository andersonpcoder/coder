"use client";

import { Copy, Link2, Trash2 } from "lucide-react";
import { useState } from "react";
import { createInvite } from "@/components/equipe/invite";
import { roleLabel } from "@/components/shell/nav";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { formatDate } from "@/lib/format";
import { useLookups, useStore } from "@/lib/store";
import type { Role, User } from "@/lib/types";

const ROLES: Role[] = ["admin", "recepcao", "profissional"];

export function UsuariosTab() {
  const { state, db, supabase, toast } = useStore();
  const { currentUser } = useLookups();
  const [role, setRole] = useState<Role>("recepcao");
  const [professionalId, setProfessionalId] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const [removing, setRemoving] = useState<User | null>(null);

  const invite = async () => {
    if (role === "profissional" && !professionalId) return toast("Escolha qual profissional da agenda é esta pessoa.", "erro");
    const to = email.trim();
    const created = await createInvite(db, role, { email: to || undefined, professionalId: role === "profissional" ? professionalId : undefined });
    if (!created) return;
    setLink(created.link);
    setEmail("");
    if (to && supabase) {
      const { error } = await supabase.functions.invoke("send-invite", { body: { invite_id: created.id, email: to } });
      toast(error ? "Convite criado, mas o e-mail não saiu. Copie o link e envie." : `Convite enviado para ${to}.`, error ? "erro" : "sucesso");
    }
  };
  const copy = (l: string) => {
    navigator.clipboard?.writeText(l);
    toast("Link copiado. Envie para a pessoa pelo WhatsApp ou e-mail.", "sucesso");
  };

  const pending = state.invites.filter((i) => !i.acceptedAt);
  const unlinkedPros = state.professionals.filter((p) => p.active && !p.userId);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Pessoas com acesso</CardTitle></CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {state.users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <Avatar name={u.name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{u.name}{u.id === currentUser.id && <span className="font-normal text-muted"> (você)</span>}</span>
                {u.id === currentUser.id ? (
                  <Badge tone="primary">{roleLabel[u.role]}</Badge>
                ) : (
                  <>
                    <Select aria-label={`Papel de ${u.name}`} value={u.role} className="w-auto" onChange={(e) => void db.patch("users", u.id, { role: e.target.value as Role })}>
                      {ROLES.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
                    </Select>
                    <Button variant="ghost" size="icon" aria-label={`Remover acesso de ${u.name}`} onClick={() => setRemoving(u)}><Trash2 /></Button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid gap-1 rounded-2xl bg-surface-2 p-3 text-xs text-muted">
            <div><dt className="inline font-semibold text-text">Administrador:</dt> <dd className="inline">tudo, inclusive financeiro, plano e configurações.</dd></div>
            <div><dt className="inline font-semibold text-text">Recepção:</dt> <dd className="inline">agenda, fila, atendimentos, clientes e caixa do dia.</dd></div>
            <div><dt className="inline font-semibold text-text">Profissional:</dt> <dd className="inline">só a própria agenda e os próprios clientes.</dd></div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Convidar</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Papel">
              {(id) => (
                <Select id={id} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                  {ROLES.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
                </Select>
              )}
            </Field>
            <Field label="E-mail (opcional)" hint={supabase ? "Enviamos o convite por e-mail." : undefined}>
              {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />}
            </Field>
            {role === "profissional" && (
              <Field label="Profissional na agenda" className="sm:col-span-2">
                {(id) => (
                  <Select id={id} value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
                    <option value="">Selecione…</option>
                    {unlinkedPros.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                )}
              </Field>
            )}
          </div>
          <Button onClick={invite} className="self-start"><Link2 /> Gerar link de convite</Button>
          {link && (
            <div className="flex gap-2">
              <Input readOnly value={link} aria-label="Link do convite" onFocus={(e) => e.target.select()} />
              <Button variant="outline" onClick={() => copy(link)}><Copy /> Copiar</Button>
            </div>
          )}
          {pending.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Convites pendentes</h3>
              <ul className="divide-y divide-border text-sm">
                {pending.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 py-2">
                    <span className="flex-1">
                      {roleLabel[i.role]}
                      {i.professionalId && ` · ${state.professionals.find((p) => p.id === i.professionalId)?.name}`}
                      {i.email && ` · ${i.email}`}
                      <span className="block text-xs text-muted">criado em {formatDate(i.createdAt)}</span>
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => copy(`${window.location.origin}/convite/${i.token}`)}><Copy /> Copiar</Button>
                    <Button variant="ghost" size="icon" aria-label="Revogar convite" onClick={() => void db.remove("invites", [i.id])}><Trash2 /></Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={!!removing}
        title={`Remover o acesso de ${removing?.name}?`}
        confirmLabel="Remover acesso"
        danger
        onConfirm={async () => {
          if (removing && (await db.remove("users", [removing.id]))) toast("Acesso removido.", "sucesso");
          setRemoving(null);
        }}
        onClose={() => setRemoving(null)}
      >
        <p className="text-sm text-muted">A pessoa deixa de acessar esta empresa. O histórico de atendimentos continua.</p>
      </ConfirmDialog>
    </div>
  );
}
