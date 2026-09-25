"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { money } from "@/lib/format";
import { annualPriceCents, ANNUAL_MONTHS_CHARGED, LAUNCH_PRICING, PLANS, TRIAL_DAYS, type BillingCycle, type PlanInfo } from "@/lib/plans";
import { cn } from "@/lib/utils";

export function CycleToggle({ value, onChange }: { value: BillingCycle; onChange: (c: BillingCycle) => void }) {
  return (
    <Segmented
      label="Forma de cobrança"
      value={value}
      onChange={onChange}
      options={[
        { value: "mensal", label: "Mensal" },
        { value: "anual", label: `Anual (${12 - ANNUAL_MONTHS_CHARGED} meses grátis)` },
      ]}
    />
  );
}

/** Preço do plano: mensal ou anual, com o preço cheio riscado durante o lançamento. */
export function PriceTag({ plan, cycle }: { plan: PlanInfo; cycle: BillingCycle }) {
  const annual = cycle === "anual";
  const price = annual ? annualPriceCents(plan) : plan.priceCents;
  const list = annual ? plan.listPriceCents * 12 : plan.listPriceCents;
  return (
    <div className="mt-2">
      {LAUNCH_PRICING && (
        <p className="flex items-center gap-2 text-sm">
          <span className="text-muted line-through">{money(list)}</span>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">Preço de lançamento</span>
        </p>
      )}
      <p>
        <span className="font-display text-3xl font-bold">{money(price)}</span>
        <span className="text-muted">/{annual ? "ano" : "mês"}</span>
      </p>
      {annual && (
        <p className="text-xs text-muted">
          Equivale a {money(Math.round(price / 12))}/mês. Você economiza {money(plan.priceCents * 12 - price)}.
        </p>
      )}
    </div>
  );
}

export function PlanHighlights({ plan }: { plan: PlanInfo }) {
  return (
    <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm">
      {plan.highlights.map((h) => (
        <li key={h} className="flex gap-2"><Check className="size-4 shrink-0 text-primary" aria-hidden /> {h}</li>
      ))}
    </ul>
  );
}

/** Seção de planos da página inicial. */
export function PricingSection() {
  const [cycle, setCycle] = useState<BillingCycle>("mensal");
  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted">
          Todos com {TRIAL_DAYS} dias grátis, sem cartão. Pague com Pix ou cartão. Cancele quando quiser.
          {LAUNCH_PRICING && " Quem assina no lançamento mantém o preço."}
        </p>
        <CycleToggle value={cycle} onChange={setCycle} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {Object.values(PLANS).map((p) => (
          <div key={p.tier} className={cn("flex flex-col rounded-[var(--radius-card)] border bg-surface p-6", p.tier === "profissional" ? "border-primary ring-1 ring-primary" : "border-border")}>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">{p.name}</h3>
              {p.tier === "profissional" && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">Mais escolhido</span>}
            </div>
            <PriceTag plan={p} cycle={cycle} />
            <PlanHighlights plan={p} />
            <Button className="mt-6" variant={p.tier === "profissional" ? "primary" : "outline"} asChild>
              <Link href="/cadastrar">Começar grátis</Link>
            </Button>
          </div>
        ))}
      </div>
    </>
  );
}
