"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { BRAND_COLORS, SEGMENTS, slugify, TIMEZONES } from "@/lib/segments";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function EmpresaTab() {
  const { state, db, supabase, toast } = useStore();
  const c = state.company;
  const [name, setName] = useState(c.name);
  const [slug, setSlug] = useState(c.slug);
  const [segment, setSegment] = useState(c.segment ?? "");
  const [timezone, setTimezone] = useState(c.timezone);
  const [color, setColor] = useState(c.primaryColor);
  const [slugOk, setSlugOk] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/${c.slug}`;

  useEffect(() => {
    setSlugOk(null);
    if (!supabase || slug === c.slug || slug.length < 3) return;
    const t = window.setTimeout(async () => {
      const { data } = await supabase.rpc("slug_available", { p_slug: slug });
      setSlugOk(Boolean(data));
    }, 400);
    return () => window.clearTimeout(t);
  }, [slug, supabase, c.slug]);

  const save = async () => {
    if (!name.trim()) return toast("Informe o nome.", "erro");
    if (slug !== c.slug && slugOk === false) return toast("Este link já está em uso.", "erro");
    setSaving(true);
    const ok = await db.patchCompany({ name: name.trim(), slug, segment: segment || undefined, timezone, primaryColor: color });
    setSaving(false);
    if (ok) toast("Dados da empresa salvos.", "sucesso");
  };

  const uploadLogo = async (file: File) => {
    if (file.size > 2_000_000) return toast("Use uma imagem de até 2 MB.", "erro");
    if (!supabase) {
      const reader = new FileReader();
      reader.onload = () => void db.patchCompany({ logoUrl: String(reader.result) });
      reader.readAsDataURL(file);
      return;
    }
    const path = `${c.id}/logo-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (error) return toast(`Não foi possível enviar o logo: ${error.message}`, "erro");
    await db.patchCompany({ logoUrl: supabase.storage.from("logos").getPublicUrl(path).data.publicUrl });
    toast("Logo atualizado.", "sucesso");
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader><CardTitle>Dados da empresa</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" className="sm:col-span-2">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Link público" className="sm:col-span-2" hint={slug !== c.slug ? (slugOk === false ? "Já está em uso." : slugOk ? "Disponível. Links antigos deixam de funcionar." : "Verificando…") : undefined}>
            {(id) => <Input id={id} value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />}
          </Field>
          <Field label="Tipo de negócio">
            {(id) => (
              <Select id={id} value={segment} onChange={(e) => setSegment(e.target.value)}>
                <option value="">Não informado</option>
                {SEGMENTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Fuso horário">
            {(id) => (
              <Select id={id} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {TIMEZONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            )}
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-[13px] font-semibold">Cor principal (página pública)</legend>
            <div className="flex flex-wrap gap-2">
              {BRAND_COLORS.map((b) => (
                <button key={b} type="button" aria-label={`Cor ${b}`} aria-pressed={color === b} onClick={() => setColor(b)} className={cn("grid size-11 place-items-center rounded-full ring-offset-2 ring-offset-surface", color === b && "ring-2 ring-text")} style={{ background: b }}>
                  {color === b && <Check className="size-4 text-white" />}
                </button>
              ))}
              <input aria-label="Outra cor" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="size-11 cursor-pointer rounded-full border border-border bg-transparent" />
            </div>
          </fieldset>
          <div className="sm:col-span-2"><Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button></div>
        </CardContent>
      </Card>
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader><CardTitle>Página de agendamento</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted">Compartilhe no Instagram, no WhatsApp e no Google Meu Negócio.</p>
            <Input readOnly value={link} aria-label="Link público" onFocus={(e) => e.target.select()} />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(link); toast("Link copiado.", "sucesso"); }}><Copy /> Copiar</Button>
              <Button variant="outline" asChild><a href={`/${c.slug}`} target="_blank" rel="noreferrer"><ExternalLink /> Abrir</a></Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Logo</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-4">
            {c.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.logoUrl} alt="Logo atual" className="size-20 rounded-2xl border border-border object-contain p-1" />
            ) : (
              <span className="grid size-20 place-items-center rounded-2xl bg-surface-2 font-display text-2xl font-bold">{c.name[0]}</span>
            )}
            <Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" aria-label="Enviar logo" className="py-2" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
