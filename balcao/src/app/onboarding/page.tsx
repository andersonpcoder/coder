"use client";

import { Check, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormError } from "@/components/auth/auth-shell";
import { Logo } from "@/components/shell/logo";
import { isValidHours, WeekHoursEditor } from "@/components/shared/week-hours";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { persist } from "@/lib/db/persist";
import { hoursToJson } from "@/lib/db/mappers";
import { formatDuration } from "@/lib/format";
import { BRAND_COLORS, SEGMENTS, slugify, TIMEZONES } from "@/lib/segments";
import { createClient, errorMessage, isDemoMode } from "@/lib/supabase/client";
import type { Professional, Service, WorkHours } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = ["Sua empresa", "Horários e serviços", "Equipe"];

interface DraftService {
  key: string;
  name: string;
  category: string;
  durationMin: number;
  price: string;
  color: Service["color"];
}

const defaultHours: WorkHours = { 1: [{ start: 540, end: 1080 }], 2: [{ start: 540, end: 1080 }], 3: [{ start: 540, end: 1080 }], 4: [{ start: 540, end: 1080 }], 5: [{ start: 540, end: 1080 }], 6: [{ start: 540, end: 780 }] };

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Passo 1
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugOk, setSlugOk] = useState<boolean | null>(null);
  const [segment, setSegment] = useState(SEGMENTS[0].value);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState({ line: "", city: "", state: "", postal: "" });
  const [timezone, setTimezone] = useState(TIMEZONES[0].value);
  const [color, setColor] = useState(BRAND_COLORS[0]);
  const [logo, setLogo] = useState<File | null>(null);

  // Passo 2
  const [hours, setHours] = useState<WorkHours>(defaultHours);
  const [services, setServices] = useState<DraftService[]>([]);

  // Passo 3
  const [meName, setMeName] = useState("");
  const [iAttend, setIAttend] = useState(true);
  const [team, setTeam] = useState<{ key: string; name: string; title: string }[]>([]);

  const template = SEGMENTS.find((s) => s.value === segment) ?? SEGMENTS[0];

  useEffect(() => {
    setServices(
      template.services.map((s, i) => ({ key: `${segment}-${i}`, ...s, price: (s.priceCents / 100).toFixed(2).replace(".", ",") })),
    );
  }, [segment, template.services]);

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  useEffect(() => {
    if (isDemoMode()) return;
    createClient().auth.getUser().then(({ data }) => {
      setMeName((data.user?.user_metadata?.full_name as string) ?? "");
    });
  }, []);

  // Confere se o link público está livre, com um pequeno atraso ao digitar.
  useEffect(() => {
    setSlugOk(null);
    if (slug.length < 3 || isDemoMode()) return;
    const t = window.setTimeout(async () => {
      const { data } = await createClient().rpc("slug_available", { p_slug: slug });
      setSlugOk(Boolean(data));
    }, 400);
    return () => window.clearTimeout(t);
  }, [slug]);

  const origin = typeof window === "undefined" ? "" : window.location.host;

  const next = () => {
    setError("");
    if (step === 0) {
      if (!name.trim()) return setError("Informe o nome da empresa.");
      if (slug.length < 3) return setError("O link precisa ter pelo menos 3 caracteres.");
      if (slugOk === false) return setError("Este link já está em uso. Escolha outro.");
    }
    if (step === 1) {
      if (!Object.keys(hours).length) return setError("Marque pelo menos um dia de funcionamento.");
      if (!isValidHours(hours)) return setError("Confira os horários: o fim precisa ser depois do início.");
      if (!services.some((s) => s.name.trim())) return setError("Cadastre pelo menos um serviço.");
    }
    setStep(step + 1);
  };

  const finish = async () => {
    setError("");
    if (!iAttend && !team.some((t) => t.name.trim())) return setError("Cadastre pelo menos um profissional.");
    if (isDemoMode()) {
      router.replace("/painel");
      return;
    }
    setSaving(true);
    try {
      const sb = createClient();
      const { data: user } = await sb.auth.getUser();
      const { data: companyId, error: rpcError } = await sb.rpc("create_company", {
        p_name: name.trim(),
        p_slug: slug,
        p_segment: segment,
        p_timezone: timezone,
        p_business_hours: hoursToJson(hours),
      });
      if (rpcError) throw rpcError;
      const cid = companyId as string;

      await sb.from("companies").update({ primary_color: color }).eq("id", cid);
      await sb
        .from("units")
        .update({ phone: phone.replace(/\D/g, "") || null, address_line: address.line || null, city: address.city || null, state: address.state || null, postal_code: address.postal || null })
        .eq("company_id", cid);

      if (logo) {
        const path = `${cid}/logo-${Date.now()}.${logo.name.split(".").pop()}`;
        const { error: upErr } = await sb.storage.from("logos").upload(path, logo, { upsert: true });
        if (!upErr) {
          const url = sb.storage.from("logos").getPublicUrl(path).data.publicUrl;
          await sb.from("companies").update({ logo_url: url }).eq("id", cid);
        }
      }

      const serviceRows: Service[] = services
        .filter((s) => s.name.trim())
        .map((s) => ({
          id: crypto.randomUUID(),
          name: s.name.trim(),
          category: s.category.trim() || "Geral",
          durationMin: s.durationMin,
          priceCents: Math.round(Number(s.price.replace(/\./g, "").replace(",", ".")) * 100) || 0,
          color: s.color,
          active: true,
        }));
      await persist(sb, cid, { kind: "upsert", collection: "services", items: serviceRows });

      const pros: Professional[] = [
        ...(iAttend ? [{ name: meName.trim() || "Eu", title: template.professionalTitle, userId: user.user?.id }] : []),
        ...team.filter((t) => t.name.trim()).map((t) => ({ name: t.name.trim(), title: t.title.trim() || template.professionalTitle, userId: undefined })),
      ].map((p) => ({
        id: crypto.randomUUID(),
        name: p.name,
        title: p.title,
        avatarHue: 0,
        commissionPct: 0,
        serviceIds: serviceRows.map((s) => s.id),
        workHours: hours,
        active: true,
        userId: p.userId,
      }));
      await persist(sb, cid, { kind: "upsert", collection: "professionals", items: pros });

      try {
        localStorage.setItem("balcao:empresa", cid);
      } catch {
        // Sem preferência salva; o painel abre a primeira empresa.
      }
      router.replace("/painel");
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <Logo />
          <span className="text-sm text-muted">Teste grátis de 14 dias</span>
        </div>
        <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Etapas do cadastro">
          {STEPS.map((label, i) => (
            <li key={label} aria-current={i === step ? "step" : undefined} className="flex flex-col gap-2">
              <span className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-border")} />
              <span className={cn("text-xs font-semibold sm:text-sm", i === step ? "text-text" : "text-muted")}>
                {i + 1}. {label}
              </span>
            </li>
          ))}
        </ol>

        <main className="rounded-[20px] border border-border bg-surface p-5 sm:p-8">
          {isDemoMode() && (
            <p className="mb-4 rounded-xl bg-accent-soft px-3 py-2 text-sm">Modo demonstração: o cadastro não é salvo.</p>
          )}
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <h1 className="text-2xl font-semibold sm:col-span-2">Conte sobre o seu negócio</h1>
              <Field label="Nome da empresa" className="sm:col-span-2">
                {(id) => <Input id={id} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Barbearia do Zé" />}
              </Field>
              <Field
                label="Link da página de agendamento"
                className="sm:col-span-2"
                hint={slugOk === false ? "Já está em uso." : slugOk ? "Disponível!" : "Só letras minúsculas, números e hífens."}
              >
                {(id) => (
                  <div className="flex items-center rounded-xl border border-border focus-within:border-primary">
                    <span className="pl-3 text-sm text-muted">{origin}/</span>
                    <input
                      id={id}
                      value={slug}
                      onChange={(e) => {
                        setSlugTouched(true);
                        setSlug(slugify(e.target.value));
                      }}
                      className="min-h-11 flex-1 bg-transparent pr-3 text-sm outline-none"
                    />
                    {slugOk && <Check className="mr-3 size-4 text-success" aria-hidden />}
                  </div>
                )}
              </Field>
              <Field label="Tipo de negócio">
                {(id) => (
                  <Select id={id} value={segment} onChange={(e) => setSegment(e.target.value)}>
                    {SEGMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="WhatsApp da empresa">
                {(id) => <Input id={id} inputMode="tel" placeholder="(11) 90000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />}
              </Field>
              <Field label="Endereço" className="sm:col-span-2">
                {(id) => <Input id={id} placeholder="Rua e número, bairro" value={address.line} onChange={(e) => setAddress({ ...address, line: e.target.value })} />}
              </Field>
              <div className="grid grid-cols-[1fr_80px_120px] gap-3 sm:col-span-2">
                <Field label="Cidade">{(id) => <Input id={id} value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />}</Field>
                <Field label="UF">{(id) => <Input id={id} maxLength={2} value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase() })} />}</Field>
                <Field label="CEP">{(id) => <Input id={id} inputMode="numeric" value={address.postal} onChange={(e) => setAddress({ ...address, postal: e.target.value })} />}</Field>
              </div>
              <Field label="Fuso horário">
                {(id) => (
                  <Select id={id} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                    {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </Select>
                )}
              </Field>
              <Field label="Logo (opcional)">
                {(id) => <Input id={id} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="py-2" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} />}
              </Field>
              <fieldset className="sm:col-span-2">
                <legend className="mb-2 text-[13px] font-semibold">Cor principal</legend>
                <div className="flex flex-wrap gap-2">
                  {BRAND_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Cor ${c}`}
                      aria-pressed={color === c}
                      onClick={() => setColor(c)}
                      className={cn("grid size-11 place-items-center rounded-full ring-offset-2 ring-offset-surface", color === c && "ring-2 ring-text")}
                      style={{ background: c }}
                    >
                      {color === c && <Check className="size-4 text-white" />}
                    </button>
                  ))}
                  <input aria-label="Outra cor" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="size-11 cursor-pointer rounded-full border border-border bg-transparent" />
                </div>
              </fieldset>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-semibold">Horário de funcionamento</h1>
                <p className="mt-1 text-sm text-muted">Vale como horário inicial de toda a equipe. Dá para ajustar por profissional depois.</p>
                <div className="mt-4"><WeekHoursEditor value={hours} onChange={setHours} /></div>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Serviços</h2>
                <p className="mt-1 text-sm text-muted">Sugestões para {template.label.toLowerCase()}. Ajuste nome, duração e preço.</p>
                <div className="mt-3 flex flex-col gap-3">
                  {services.map((s, i) => (
                    <div key={s.key} className="grid grid-cols-[1fr_auto] gap-2 rounded-2xl bg-surface-2 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                      <Input aria-label="Nome do serviço" value={s.name} onChange={(e) => setServices(services.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      <Select aria-label="Duração" value={s.durationMin} onChange={(e) => setServices(services.map((x, j) => (j === i ? { ...x, durationMin: Number(e.target.value) } : x)))} className="hidden sm:block">
                        {[15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240].map((m) => <option key={m} value={m}>{formatDuration(m)}</option>)}
                      </Select>
                      <Input aria-label="Preço (R$)" inputMode="decimal" value={s.price} onChange={(e) => setServices(services.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} className="hidden sm:block" />
                      <Button variant="ghost" size="icon" aria-label={`Remover ${s.name}`} onClick={() => setServices(services.filter((_, j) => j !== i))}>
                        <Trash2 />
                      </Button>
                      <div className="col-span-2 grid grid-cols-2 gap-2 sm:hidden">
                        <Select aria-label="Duração" value={s.durationMin} onChange={(e) => setServices(services.map((x, j) => (j === i ? { ...x, durationMin: Number(e.target.value) } : x)))}>
                          {[15, 20, 30, 45, 60, 75, 90, 120, 150, 180, 240].map((m) => <option key={m} value={m}>{formatDuration(m)}</option>)}
                        </Select>
                        <Input aria-label="Preço (R$)" inputMode="decimal" value={s.price} onChange={(e) => setServices(services.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    className="self-start"
                    onClick={() => setServices([...services, { key: crypto.randomUUID(), name: "", category: "Geral", durationMin: 30, price: "0,00", color: "ceu" }])}
                  >
                    <Plus /> Adicionar serviço
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <h1 className="text-2xl font-semibold">Quem atende?</h1>
              <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
                <input type="checkbox" className="size-5 accent-[var(--primary)]" checked={iAttend} onChange={(e) => setIAttend(e.target.checked)} />
                Eu também atendo clientes
              </label>
              {iAttend && (
                <Field label="Seu nome na agenda">
                  {(id) => <Input id={id} value={meName} onChange={(e) => setMeName(e.target.value)} />}
                </Field>
              )}
              <h2 className="mt-2 text-lg font-semibold">Outros profissionais</h2>
              {team.map((t, i) => (
                <div key={t.key} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input aria-label="Nome" placeholder="Nome" value={t.name} onChange={(e) => setTeam(team.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <Input aria-label="Função" placeholder={template.professionalTitle} value={t.title} onChange={(e) => setTeam(team.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                  <Button variant="ghost" size="icon" aria-label="Remover" onClick={() => setTeam(team.filter((_, j) => j !== i))}><Trash2 /></Button>
                </div>
              ))}
              <Button variant="outline" className="self-start" onClick={() => setTeam([...team, { key: crypto.randomUUID(), name: "", title: "" }])}>
                <Plus /> Adicionar profissional
              </Button>
              <p className="text-sm text-muted">
                Depois você pode convidar cada pessoa para acessar a própria agenda em Configurações &gt; Usuários.
              </p>
            </div>
          )}

          <div className="mt-6"><FormError message={error} /></div>
          <div className="mt-4 flex justify-between gap-2">
            {step > 0 ? <Button variant="ghost" onClick={() => setStep(step - 1)}>Voltar</Button> : <Button variant="ghost" onClick={async () => { if (!isDemoMode()) await createClient().auth.signOut(); router.replace("/entrar"); }}>Sair</Button>}
            {step < 2 ? (
              <Button onClick={next}>Continuar</Button>
            ) : (
              <Button onClick={finish} disabled={saving}>{saving ? "Criando sua agenda…" : "Concluir e abrir o painel"}</Button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
