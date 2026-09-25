"use client";

import { Copy, KeyRound, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { formatDate } from "@/lib/format";
import { hasFeature } from "@/lib/plans";
import { newId, useStore } from "@/lib/store";
import type { Integration, IntegrationProvider } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProviderDef {
  provider: IntegrationProvider;
  name: string;
  description: string;
  fields: { key: string; label: string; placeholder?: string }[];
  secretLabel: string;
  webhook: (base: string, verify: string) => string;
}

const WHATSAPP: ProviderDef[] = [
  {
    provider: "whatsapp_cloud",
    name: "WhatsApp Cloud API (oficial da Meta)",
    description: "Recomendado. Crie o app em developers.facebook.com e ligue o número do WhatsApp Business.",
    fields: [{ key: "phone_number_id", label: "ID do número de telefone" }, { key: "business_account_id", label: "ID da conta do WhatsApp Business" }],
    secretLabel: "Token de acesso permanente",
    webhook: (base) => `${base}/functions/v1/meta-webhook`,
  },
  {
    provider: "zapi",
    name: "Z-API",
    description: "Conecta pelo QR Code do WhatsApp do celular.",
    fields: [{ key: "instance_id", label: "ID da instância" }, { key: "client_token", label: "Client-Token da conta (segurança)" }],
    secretLabel: "Token da instância",
    webhook: (base, verify) => `${base}/functions/v1/whatsapp-webhook?provider=zapi&chave=${verify}`,
  },
  {
    provider: "evolution",
    name: "Evolution API",
    description: "Servidor próprio da Evolution API.",
    fields: [{ key: "base_url", label: "URL do servidor", placeholder: "https://evolution.seudominio.com" }, { key: "instance", label: "Nome da instância" }],
    secretLabel: "API key",
    webhook: (base, verify) => `${base}/functions/v1/whatsapp-webhook?provider=evolution&chave=${verify}`,
  },
];

const INSTAGRAM: ProviderDef = {
  provider: "instagram",
  name: "Instagram Direct",
  description: "Conta profissional ligada a uma página do Facebook, com o app da Meta autorizado para mensagens.",
  fields: [{ key: "account_id", label: "ID da conta do Instagram" }],
  secretLabel: "Token de acesso da página",
  webhook: (base) => `${base}/functions/v1/meta-webhook`,
};

const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");

export function IntegracoesTab() {
  const { state } = useStore();
  const [provider, setProvider] = useState<IntegrationProvider>(
    state.integrations.find((i) => i.provider !== "instagram" && i.active)?.provider ?? "whatsapp_cloud",
  );
  const def = WHATSAPP.find((w) => w.provider === provider)!;
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader><CardTitle>WhatsApp</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Provedor de WhatsApp">
            {WHATSAPP.map((w) => {
              const active = state.integrations.some((i) => i.provider === w.provider && i.active);
              return (
                <button key={w.provider} type="button" role="radio" aria-checked={provider === w.provider} onClick={() => setProvider(w.provider)}
                  className={cn("min-h-11 rounded-xl border px-3 text-sm font-semibold", provider === w.provider ? "border-primary bg-primary-soft text-primary" : "border-border")}>
                  {w.name.split(" (")[0]} {active && <Badge tone="success" className="ml-1">ativo</Badge>}
                </button>
              );
            })}
          </div>
          <IntegrationForm def={def} exclusiveGroup={WHATSAPP.map((w) => w.provider)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Instagram</CardTitle></CardHeader>
        <CardContent><IntegrationForm def={INSTAGRAM} /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Chat do site</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted">
          Já vem ativo na sua página de agendamento (botão &quot;Fale conosco&quot;). As mensagens chegam em Atendimentos, no canal Site.
        </CardContent>
      </Card>
      <ApiKeysCard />
    </div>
  );
}

function IntegrationForm({ def, exclusiveGroup }: { def: ProviderDef; exclusiveGroup?: IntegrationProvider[] }) {
  const { state, db, supabase, toast } = useStore();
  const existing = state.integrations.find((i) => i.provider === def.provider);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setSettings(existing?.settings ?? { verify_token: randomToken() });
    setSecret("");
  }, [existing, def.provider]);

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://SEU-PROJETO.supabase.co";
  const verify = settings.verify_token ?? "";

  const save = async (activate: boolean) => {
    if (activate && def.fields.some((f) => f.key !== "client_token" && f.key !== "business_account_id" && !settings[f.key]?.trim())) {
      return toast("Preencha os campos obrigatórios.", "erro");
    }
    if (activate && !existing && !secret) return toast(`Informe o ${def.secretLabel.toLowerCase()}.`, "erro");
    setSaving(true);
    const item: Integration = { id: existing?.id ?? newId(), provider: def.provider, settings: { ...settings, verify_token: verify || randomToken() }, active: activate };
    // Só um provedor de WhatsApp fica ativo por vez.
    const others = activate && exclusiveGroup
      ? state.integrations.filter((i) => exclusiveGroup.includes(i.provider) && i.provider !== def.provider && i.active).map((i) => ({ ...i, active: false }))
      : [];
    let ok = await db.upsert("integrations", [item, ...others]);
    if (ok && secret && supabase) {
      const { error } = await supabase.from("integrations").update({ secret }).eq("id", item.id);
      if (error) {
        ok = false;
        toast(`Não foi possível salvar o token: ${error.message}`, "erro");
      }
    }
    setSaving(false);
    if (ok) {
      setSecret("");
      toast(activate ? `${def.name.split(" (")[0]} ativado.` : "Integração desativada.", "sucesso");
    }
  };

  const copy = (v: string) => {
    navigator.clipboard?.writeText(v);
    toast("Copiado.", "sucesso");
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <p className="text-sm text-muted sm:col-span-2">{def.description}</p>
      {def.fields.map((f) => (
        <Field key={f.key} label={f.label}>
          {(id) => <Input id={id} placeholder={f.placeholder} value={settings[f.key] ?? ""} onChange={(e) => setSettings({ ...settings, [f.key]: e.target.value })} />}
        </Field>
      ))}
      <Field label={def.secretLabel} hint={existing ? "Já salvo. Preencha só para trocar." : "Fica guardado no servidor e não aparece mais na tela."}>
        {(id) => <Input id={id} type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} />}
      </Field>
      <div className="rounded-2xl bg-surface-2 p-3 text-sm sm:col-span-2">
        <p className="font-semibold">Configure o webhook no provedor</p>
        <div className="mt-2 flex gap-2">
          <Input readOnly aria-label="URL do webhook" value={def.webhook(base, verify)} onFocus={(e) => e.target.select()} />
          <Button variant="outline" size="icon" aria-label="Copiar URL" onClick={() => copy(def.webhook(base, verify))}><Copy /></Button>
        </div>
        {(def.provider === "whatsapp_cloud" || def.provider === "instagram") && (
          <div className="mt-2 flex gap-2">
            <Input readOnly aria-label="Token de verificação" value={verify} onFocus={(e) => e.target.select()} />
            <Button variant="outline" size="icon" aria-label="Copiar token de verificação" onClick={() => copy(verify)}><Copy /></Button>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <Button onClick={() => save(true)} disabled={saving}>{existing?.active ? "Salvar" : "Salvar e ativar"}</Button>
        {existing?.active && <Button variant="outline" onClick={() => save(false)} disabled={saving}>Desativar</Button>}
      </div>
    </div>
  );
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function ApiKeysCard() {
  const { state, db, toast } = useStore();
  const [name, setName] = useState("");
  const [created, setCreated] = useState("");
  const allowed = hasFeature(state.subscription, "api");
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://SEU-PROJETO.supabase.co";

  const create = async () => {
    const key = `blc_${randomToken()}${randomToken()}`;
    const ok = await db.upsert("apiKeys", [
      { id: newId(), name: name.trim() || "Integração", prefix: key.slice(0, 12), keyHash: await sha256(key), createdAt: new Date().toISOString() },
    ]);
    if (ok) {
      setCreated(key);
      setName("");
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="size-4" /> API</CardTitle>{!allowed && <Badge tone="accent">Plano Empresa</Badge>}</CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="text-muted">Integre sistemas externos (site próprio, ERP, automações). Envie a chave no cabeçalho <code>Authorization: Bearer</code>.</p>
        <pre className="overflow-x-auto rounded-xl bg-surface-2 p-3 text-xs">{`GET  ${base}/functions/v1/api/agendamentos?de=2026-01-01&ate=2026-01-31
POST ${base}/functions/v1/api/agendamentos   {"servico_id","profissional_id","inicio","cliente":{"nome","telefone"}}
GET  ${base}/functions/v1/api/clientes?busca=maria
GET  ${base}/functions/v1/api/horarios?servico_id=...&profissional_id=...&dia=2026-01-15`}</pre>
        {allowed && (
          <>
            <div className="flex flex-wrap gap-2">
              <Input aria-label="Nome da chave" placeholder="Nome da chave (ex.: Site)" className="max-w-xs" value={name} onChange={(e) => setName(e.target.value)} />
              <Button onClick={create}><Plus /> Criar chave</Button>
            </div>
            {created && (
              <div className="rounded-2xl bg-warning-soft p-3" role="status">
                <p className="font-semibold">Copie agora: a chave não será mostrada de novo.</p>
                <div className="mt-2 flex gap-2">
                  <Input readOnly value={created} aria-label="Nova chave" onFocus={(e) => e.target.select()} />
                  <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(created); toast("Chave copiada.", "sucesso"); }}><Copy /></Button>
                </div>
              </div>
            )}
            <ul className="divide-y divide-border">
              {state.apiKeys.map((k) => (
                <li key={k.id} className="flex items-center gap-3 py-2">
                  <span className="flex-1">
                    <span className="font-semibold">{k.name}</span> <code className="text-muted">{k.prefix}…</code>
                    <span className="block text-xs text-muted">criada em {formatDate(k.createdAt)}{k.lastUsedAt ? ` · último uso ${formatDate(k.lastUsedAt)}` : ""}</span>
                  </span>
                  {k.revokedAt ? <Badge>Revogada</Badge> : (
                    <Button variant="ghost" size="sm" onClick={() => void db.patch("apiKeys", k.id, { revokedAt: new Date().toISOString() })}><Trash2 /> Revogar</Button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
