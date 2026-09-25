import { CalendarDays, Check, ListOrdered, MessagesSquare, Smartphone, UsersRound, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shell/logo";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Balcão: agenda, fila e atendimento em um só lugar",
};

const features = [
  { icon: CalendarDays, title: "Agenda inteligente", text: "Dia, semana, mês e visão por profissional. Arraste para remarcar, sem conflitos de horário." },
  { icon: ListOrdered, title: "Fila da recepção", text: "Check-in, tempo de espera em tempo real, chamada do próximo e painel de TV." },
  { icon: MessagesSquare, title: "WhatsApp, Instagram e site", text: "Todas as conversas numa caixa de entrada, com respostas rápidas e agendamento pela conversa." },
  { icon: Smartphone, title: "Agendamento online", text: "Seu link exclusivo para o cliente marcar, confirmar, remarcar ou cancelar sozinho." },
  { icon: UsersRound, title: "Clientes e lembretes", text: "Histórico, faltas, etiquetas e lembretes automáticos 24h e 2h antes do horário." },
  { icon: Wallet, title: "Financeiro e relatórios", text: "Caixa do dia, Pix, cartão e dinheiro, comissões e relatórios em PDF e CSV." },
];

export default function Home() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2" aria-label="Acesso">
          <Button variant="ghost" asChild><Link href="/entrar">Entrar</Link></Button>
          <Button asChild className="hidden sm:inline-flex"><Link href="/cadastrar">Teste grátis</Link></Button>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pt-10 pb-16 sm:px-6 sm:pt-16">
          <p className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">
            Para clínicas, consultórios, barbearias, salões e estúdios
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl leading-tight font-bold sm:text-6xl">
            O balcão do seu negócio, organizado de ponta a ponta.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Agenda, fila de espera, conversas do WhatsApp, clientes, equipe e caixa num só lugar. Feito para usar sem treinamento, no computador ou no celular.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild><Link href="/cadastrar">Começar teste grátis de {TRIAL_DAYS} dias</Link></Button>
            <Button size="lg" variant="outline" asChild><Link href="/entrar">Ver demonstração</Link></Button>
          </div>
        </section>

        <section aria-labelledby="recursos" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
          <h2 id="recursos" className="sr-only">Recursos</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-[var(--radius-card)] border border-border bg-surface p-6">
                <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                  <f.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="planos" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <h2 id="planos" className="text-3xl font-semibold">Planos</h2>
          <p className="mt-1 text-muted">Todos com {TRIAL_DAYS} dias grátis. Pague com Pix ou cartão. Cancele quando quiser.</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {Object.values(PLANS).map((p) => (
              <div key={p.tier} className={`flex flex-col rounded-[var(--radius-card)] border bg-surface p-6 ${p.tier === "profissional" ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                <h3 className="text-xl font-semibold">{p.name}</h3>
                <p className="mt-2"><span className="font-display text-3xl font-bold">{money(p.priceCents)}</span><span className="text-muted">/mês</span></p>
                <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm">
                  {p.highlights.map((h) => (
                    <li key={h} className="flex gap-2"><Check className="size-4 shrink-0 text-primary" aria-hidden /> {h}</li>
                  ))}
                </ul>
                <Button className="mt-6" variant={p.tier === "profissional" ? "primary" : "outline"} asChild>
                  <Link href="/cadastrar">Começar grátis</Link>
                </Button>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
          <span>© {new Date().getFullYear()} Balcão</span>
          <Link href="/termos" className="hover:text-text">Termos de uso e privacidade (LGPD)</Link>
        </div>
      </footer>
    </div>
  );
}
