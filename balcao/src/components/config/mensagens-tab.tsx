"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { hasFeature } from "@/lib/plans";
import { newId, useStore } from "@/lib/store";
import type { MessageTemplate, NotificationChannel, NotificationKind } from "@/lib/types";

const KINDS: { kind: NotificationKind; label: string; when: string }[] = [
  { kind: "lembrete_24h", label: "Lembrete 24h antes", when: "Enviado um dia antes do horário, com link para confirmar." },
  { kind: "lembrete_2h", label: "Lembrete 2h antes", when: "Enviado duas horas antes." },
  { kind: "aniversario", label: "Aniversário", when: "Enviado às 9h no dia do aniversário." },
  { kind: "retorno", label: "Retorno", when: "Enviado 30 dias após a última visita, se não houver nada marcado." },
];
const CHANNELS: { channel: NotificationChannel; label: string }[] = [
  { channel: "whatsapp", label: "WhatsApp" },
  { channel: "email", label: "E-mail" },
];

export function MensagensTab() {
  const { state } = useStore();
  const whatsappAllowed = hasFeature(state.subscription, "whatsapp");
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader><CardTitle>Mensagens automáticas</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-5">
          <p className="text-sm text-muted">
            Variáveis: <code>{"{nome}"}</code> <code>{"{data}"}</code> <code>{"{hora}"}</code> <code>{"{servico}"}</code> <code>{"{profissional}"}</code> <code>{"{empresa}"}</code> <code>{"{link}"}</code>. Nos lembretes o link para confirmar, remarcar ou cancelar é incluído no fim se você não usar <code>{"{link}"}</code>.
            {!whatsappAllowed && " Envio por WhatsApp disponível a partir do plano Profissional."}
          </p>
          {KINDS.map((k) => (
            <section key={k.kind} className="rounded-2xl border border-border p-4">
              <h3 className="font-semibold">{k.label}</h3>
              <p className="text-xs text-muted">{k.when}</p>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {CHANNELS.map((c) => (
                  <TemplateEditor key={c.channel} kind={k.kind} channel={c.channel} label={c.label} disabled={c.channel === "whatsapp" && !whatsappAllowed} />
                ))}
              </div>
            </section>
          ))}
        </CardContent>
      </Card>
      <QuickRepliesCard />
    </div>
  );
}

const VARIABLES = ["nome", "data", "hora", "servico", "profissional", "empresa", "link"];

function TemplateEditor({ kind, channel, label, disabled }: { kind: NotificationKind; channel: NotificationChannel; label: string; disabled: boolean }) {
  const { state, db, toast } = useStore();
  const existing = state.templates.find((t) => t.kind === kind && t.channel === channel);
  const [body, setBody] = useState(existing?.body ?? "");
  const [active, setActive] = useState(existing?.active ?? false);
  const [providerTemplate, setProviderTemplate] = useState(existing?.providerTemplate ?? "");
  const [providerParams, setProviderParams] = useState((existing?.providerParams ?? []).join(", "));
  const usesCloudApi = state.integrations.some((i) => i.provider === "whatsapp_cloud" && i.active);
  useEffect(() => {
    setBody(existing?.body ?? "");
    setActive(existing?.active ?? false);
    setProviderTemplate(existing?.providerTemplate ?? "");
    setProviderParams((existing?.providerParams ?? []).join(", "));
  }, [existing]);

  const save = async () => {
    const params = providerParams.split(",").map((p) => p.trim().replace(/[{}]/g, "")).filter(Boolean);
    const unknown = params.filter((p) => !VARIABLES.includes(p));
    if (unknown.length) return toast(`Variável desconhecida: ${unknown.join(", ")}. Use: ${VARIABLES.join(", ")}.`, "erro");
    const item: MessageTemplate = {
      id: existing?.id ?? newId(),
      kind,
      channel,
      body: body.trim(),
      active,
      providerTemplate: providerTemplate.trim() || undefined,
      providerParams: params,
    };
    if (!item.body) return toast("Escreva a mensagem.", "erro");
    if (await db.upsert("templates", [item])) toast("Mensagem salva.", "sucesso");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={active} disabled={disabled} onChange={(e) => setActive(e.target.checked)} />
          Ativo
        </label>
      </div>
      <Textarea aria-label={`${label}: texto`} value={body} disabled={disabled} onChange={(e) => setBody(e.target.value)} rows={3} />
      {channel === "whatsapp" && (usesCloudApi || providerTemplate) && (
        <div className="grid gap-2 rounded-xl bg-surface-2 p-3 sm:grid-cols-2">
          <Field label="Modelo aprovado na Meta" hint="Obrigatório na API oficial para mensagens fora da janela de 24h.">
            {(id) => <Input id={id} placeholder="lembrete_24h" value={providerTemplate} disabled={disabled} onChange={(e) => setProviderTemplate(e.target.value)} />}
          </Field>
          <Field label="Variáveis na ordem ({{1}}, {{2}}…)" hint="Ex.: nome, hora, servico, link">
            {(id) => <Input id={id} value={providerParams} disabled={disabled} onChange={(e) => setProviderParams(e.target.value)} />}
          </Field>
        </div>
      )}
      <Button variant="outline" size="sm" className="self-start" disabled={disabled} onClick={save}>Salvar</Button>
      {disabled && <Badge tone="accent" className="self-start">Plano Profissional</Badge>}
    </div>
  );
}

function QuickRepliesCard() {
  const { state, db, toast } = useStore();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const add = async () => {
    if (!title.trim() || !body.trim()) return toast("Preencha título e texto.", "erro");
    if (await db.upsert("quickReplies", [{ id: newId(), title: title.trim(), body: body.trim() }])) {
      setTitle("");
      setBody("");
    }
  };
  return (
    <Card>
      <CardHeader><CardTitle>Respostas rápidas (Atendimentos)</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Variáveis: <code>{"{nome}"}</code> <code>{"{horarios}"}</code> (próximos horários livres) <code>{"{data}"}</code> <code>{"{hora}"}</code> (próximo agendamento) <code>{"{servico}"}</code> <code>{"{profissional}"}</code> <code>{"{endereco}"}</code> <code>{"{empresa}"}</code>.
        </p>
        <ul className="flex flex-col gap-3">
          {state.quickReplies.map((q) => (
            <li key={q.id} className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{q.title}</p>
                <p className="text-sm whitespace-pre-line text-muted">{q.body}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Excluir ${q.title}`} onClick={() => void db.remove("quickReplies", [q.id])}><Trash2 /></Button>
            </li>
          ))}
        </ul>
        <div className="grid gap-3 rounded-2xl border border-dashed border-border p-4">
          <Field label="Título do botão">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Formas de pagamento" />}</Field>
          <Field label="Texto">{(id) => <Textarea id={id} value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
          <Button variant="outline" className="self-start" onClick={add}><Plus /> Adicionar resposta</Button>
        </div>
      </CardContent>
    </Card>
  );
}
