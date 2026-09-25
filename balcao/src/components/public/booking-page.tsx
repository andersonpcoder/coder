"use client";

import { ArrowLeft, CalendarPlus, CheckCircle2, Clock, MapPin, MessageCircle, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FormError } from "@/components/auth/auth-shell";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { addMinutes } from "@/lib/dates";
import { formatDayLong, formatDuration, formatPhone, formatTime, money } from "@/lib/format";
import { publicApi, type PublicCompany, type PublicProfessional, type PublicService } from "@/lib/public-api";
import { cn } from "@/lib/utils";
import { BrandScope, googleCalendarUrl } from "./brand";
import { ChatWidget } from "./chat-widget";
import { SlotPicker } from "./slot-picker";

const ANY = "__qualquer__";

export function BookingPage({ slug }: { slug: string }) {
  const [company, setCompany] = useState<PublicCompany | null | undefined>(undefined);
  const [step, setStep] = useState(0);
  const [service, setService] = useState<PublicService | null>(null);
  const [proId, setProId] = useState<string>(ANY);
  const [slot, setSlot] = useState<Date | null>(null);
  // Com "sem preferência", guarda qual profissional está livre em cada horário.
  const [slotOwner, setSlotOwner] = useState<Map<number, string>>(new Map());
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    publicApi()
      .company(slug)
      .then(setCompany)
      .catch(() => setCompany(null));
  }, [slug]);

  const eligible = useMemo(
    () => (company && service ? company.professionals.filter((p) => p.serviceIds.includes(service.id)) : []),
    [company, service],
  );

  const loadSlots = useCallback(
    async (day: Date) => {
      if (!company || !service) return [];
      const pros = proId === ANY ? eligible : eligible.filter((p) => p.id === proId);
      const lists = await Promise.all(pros.map((p) => publicApi().slots(slug, service.id, p.id, day).then((s) => [p.id, s] as const)));
      const owner = new Map<number, string>();
      for (const [pid, list] of lists) for (const s of list) if (!owner.has(s.getTime())) owner.set(s.getTime(), pid);
      setSlotOwner(owner);
      return [...owner.keys()].sort((a, b) => a - b).map((t) => new Date(t));
    },
    [company, service, proId, eligible, slug],
  );

  if (company === undefined) return <div className="grid min-h-dvh place-items-center text-muted" role="status">Carregando…</div>;
  if (company === null) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Página não encontrada</h1>
          <p className="mt-1 text-muted">Confira o endereço com o estabelecimento.</p>
        </div>
      </div>
    );
  }

  const chosenPro: PublicProfessional | undefined = company.professionals.find((p) => p.id === (slot ? (proId === ANY ? slotOwner.get(slot.getTime()) : proId) : proId));

  const book = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service || !slot || !chosenPro) return;
    if (phone.replace(/\D/g, "").length < 10) return setError("Informe um WhatsApp com DDD.");
    setError("");
    setSaving(true);
    try {
      const t = await publicApi().book({ slug, serviceId: service.id, professionalId: chosenPro.id, start: slot, name: name.trim(), phone, consent });
      setToken(t);
      setStep(4);
    } catch (err) {
      setError((err as Error).message);
      if (/disponível/.test((err as Error).message)) setStep(2);
    } finally {
      setSaving(false);
    }
  };

  const categories = [...new Set(company.services.map((s) => s.category))];
  const whatsapp = company.phone ? `https://wa.me/55${company.phone.replace(/\D/g, "")}` : undefined;

  return (
    <BrandScope color={company.primaryColor}>
      <header className="bg-primary text-primary-fg">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-8 sm:px-6">
          {company.logoUrl ? (
            // Logo enviado pela empresa (URL pública do Storage).
            // eslint-disable-next-line @next/next/no-img-element
            <img src={company.logoUrl} alt="" className="size-16 rounded-2xl bg-white object-contain p-1" />
          ) : (
            <span className="grid size-16 place-items-center rounded-2xl bg-white/15 font-display text-2xl font-bold">{company.name[0]}</span>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold sm:text-3xl">{company.name}</h1>
            {company.address && <p className="mt-1 flex items-center gap-1 text-sm opacity-90"><MapPin className="size-4" aria-hidden /> {company.address}</p>}
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline-offset-2 hover:underline">
                <MessageCircle className="size-4" aria-hidden /> {formatPhone(company.phone!)}
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 pb-28 sm:px-6">
        {step < 4 && (
          <ol className="mb-5 flex gap-2 text-xs font-semibold text-muted" aria-label="Etapas">
            {["Serviço", "Profissional", "Horário", "Seus dados"].map((l, i) => (
              <li key={l} className={cn("flex-1 border-t-4 pt-2", i <= step ? "border-primary text-text" : "border-border")} aria-current={i === step ? "step" : undefined}>{l}</li>
            ))}
          </ol>
        )}

        {step > 0 && step < 4 && (
          <Button variant="ghost" className="-ml-3 mb-2" onClick={() => setStep(step - 1)}><ArrowLeft /> Voltar</Button>
        )}

        {step === 0 && (
          <section aria-labelledby="t-servico">
            <h2 id="t-servico" className="mb-4 text-xl font-semibold">Qual serviço você quer agendar?</h2>
            {company.services.length === 0 && <p className="text-muted">Nenhum serviço disponível para agendamento online.</p>}
            {categories.map((cat) => (
              <div key={cat} className="mb-5">
                {categories.length > 1 && <h3 className="mb-2 text-sm font-semibold text-muted">{cat}</h3>}
                <div className="grid gap-2 sm:grid-cols-2">
                  {company.services.filter((s) => s.category === cat).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setService(s); setProId(ANY); setSlot(null); setStep(1); }}
                      className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 text-left hover:border-primary"
                    >
                      <span>
                        <span className="block font-semibold">{s.name}</span>
                        <span className="flex items-center gap-1 text-sm text-muted"><Clock className="size-3.5" aria-hidden /> {formatDuration(s.durationMin)}</span>
                      </span>
                      <span className="font-semibold">{s.priceCents ? money(s.priceCents) : "Sob consulta"}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {step === 1 && service && (
          <section aria-labelledby="t-pro">
            <h2 id="t-pro" className="mb-4 text-xl font-semibold">Com quem?</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => { setProId(ANY); setSlot(null); setStep(2); }} className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left hover:border-primary">
                <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-primary"><UserRound className="size-4" aria-hidden /></span>
                <span><span className="block font-semibold">Sem preferência</span><span className="text-sm text-muted">Mostra todos os horários</span></span>
              </button>
              {eligible.map((p) => (
                <button key={p.id} type="button" onClick={() => { setProId(p.id); setSlot(null); setStep(2); }} className="flex min-h-16 items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left hover:border-primary">
                  <Avatar name={p.name} />
                  <span><span className="block font-semibold">{p.name}</span>{p.title && <span className="text-sm text-muted">{p.title}</span>}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 2 && service && (
          <section aria-labelledby="t-horario">
            <h2 id="t-horario" className="mb-4 text-xl font-semibold">Escolha o dia e o horário</h2>
            <SlotPicker load={loadSlots} value={slot} onChange={setSlot} />
            <FormError message={error} />
            <Button className="mt-5 w-full sm:w-auto" disabled={!slot} onClick={() => { setError(""); setStep(3); }}>Continuar</Button>
          </section>
        )}

        {step === 3 && service && slot && (
          <section aria-labelledby="t-dados">
            <h2 id="t-dados" className="mb-4 text-xl font-semibold">Seus dados</h2>
            <div className="mb-5 rounded-2xl bg-surface-2 p-4 text-sm">
              <p className="font-semibold">{service.name} · {money(service.priceCents)}</p>
              <p className="first-letter:uppercase">{formatDayLong(slot)} às {formatTime(slot)}</p>
              <p className="text-muted">com {chosenPro?.name}</p>
            </div>
            <form onSubmit={book} className="flex flex-col gap-4">
              <Field label="Nome completo">{(id) => <Input id={id} autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />}</Field>
              <Field label="WhatsApp" hint="Enviaremos a confirmação e os lembretes por aqui.">
                {(id) => <Input id={id} type="tel" inputMode="tel" autoComplete="tel" placeholder="(11) 90000-0000" required value={phone} onChange={(e) => setPhone(e.target.value)} />}
              </Field>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" required className="mt-0.5 size-5 accent-[var(--primary)]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>Autorizo o uso dos meus dados para agendamento e lembretes, conforme os <Link href="/termos" target="_blank" className="font-semibold text-primary underline">termos e a política de privacidade (LGPD)</Link>.</span>
              </label>
              <FormError message={error} />
              <Button type="submit" size="lg" disabled={saving || !consent}>{saving ? "Agendando…" : "Confirmar agendamento"}</Button>
            </form>
          </section>
        )}

        {step === 4 && service && slot && (
          <section className="text-center" aria-live="polite">
            <CheckCircle2 className="mx-auto size-14 text-primary" aria-hidden />
            <h2 className="mt-3 text-2xl font-semibold">Agendamento feito!</h2>
            <p className="mt-2 first-letter:uppercase">{formatDayLong(slot)} às {formatTime(slot)}</p>
            <p className="text-muted">{service.name} com {chosenPro?.name}</p>
            <p className="mx-auto mt-4 max-w-md text-sm text-muted">Você vai receber um lembrete no WhatsApp antes do horário, com o link para confirmar, remarcar ou cancelar.</p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Button asChild variant="outline">
                <a href={googleCalendarUrl({ title: `${service.name} · ${company.name}`, start: slot, end: addMinutes(slot, service.durationMin), location: company.address })} target="_blank" rel="noreferrer">
                  <CalendarPlus /> Adicionar à agenda
                </a>
              </Button>
              <Button asChild><Link href={`/agendamento/${token}`}>Remarcar ou cancelar</Link></Button>
            </div>
            <Button variant="ghost" className="mt-4" onClick={() => { setStep(0); setSlot(null); setService(null); }}>Fazer outro agendamento</Button>
          </section>
        )}
      </main>
      <footer className="pb-24 text-center text-xs text-muted">Agendamento online por <Link href="/" className="font-semibold">Balcão</Link></footer>
      <ChatWidget slug={slug} company={company.name} />
    </BrandScope>
  );
}
