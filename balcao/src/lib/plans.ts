import type { PlanTier, Subscription } from "./types";

export type Feature = "fila" | "whatsapp" | "relatorios" | "atendimentos" | "unidades" | "api";

export interface PlanInfo {
  tier: PlanTier;
  name: string;
  /** Preço mensal em centavos; ajuste aqui e no provedor de cobrança. */
  priceCents: number;
  /** Preço cheio, mostrado riscado enquanto vale o preço de lançamento. */
  listPriceCents: number;
  maxProfessionals: number | null;
  features: Feature[];
  highlights: string[];
}

export const PLANS: Record<PlanTier, PlanInfo> = {
  basico: {
    tier: "basico",
    name: "Básico",
    priceCents: 1990,
    listPriceCents: 2990,
    maxProfessionals: 1,
    features: [],
    highlights: ["1 profissional", "Agenda completa", "Página pública de agendamento", "Lembretes por e-mail"],
  },
  profissional: {
    tier: "profissional",
    name: "Profissional",
    priceCents: 3990,
    listPriceCents: 5990,
    maxProfessionals: 5,
    features: ["fila", "whatsapp", "relatorios"],
    highlights: ["Até 5 profissionais", "Fila de atendimento e painel de TV", "Lembretes por WhatsApp", "Relatórios"],
  },
  empresa: {
    tier: "empresa",
    name: "Empresa",
    priceCents: 7990,
    listPriceCents: 11990,
    maxProfessionals: null,
    features: ["fila", "whatsapp", "relatorios", "atendimentos", "unidades", "api"],
    highlights: ["Profissionais ilimitados", "Várias unidades", "Caixa de entrada unificada", "API"],
  },
};

export const TRIAL_DAYS = 14;

/** Enquanto verdadeiro, os preços aparecem como "preço de lançamento" com o cheio riscado. */
export const LAUNCH_PRICING = true;

/** Plano anual: paga 10 meses e usa 12. */
export const ANNUAL_MONTHS_CHARGED = 10;
export type BillingCycle = "mensal" | "anual";

export function annualPriceCents(plan: PlanInfo): number {
  return plan.priceCents * ANNUAL_MONTHS_CHARGED;
}

/** Dias de tolerância para pagamento atrasado antes de bloquear a agenda. */
export const GRACE_DAYS = 7;

/** Mesma regra da função has_active_plan do banco. */
export function isActive(sub: Subscription, now = new Date()): boolean {
  switch (sub.status) {
    case "teste":
      return new Date(sub.trialEndsAt) > now;
    case "ativa":
      return true;
    case "inadimplente": {
      const base = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : now;
      return base.getTime() + GRACE_DAYS * 86_400_000 > now.getTime();
    }
    case "cancelada":
      return !!sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) > now;
  }
}

/** Mesma regra da função effective_plan do banco: no teste grátis vale o plano Empresa. */
export function effectivePlan(sub: Subscription, now = new Date()): PlanTier {
  if (sub.status === "teste" && new Date(sub.trialEndsAt) > now) return "empresa";
  return isActive(sub, now) ? sub.plan : "basico";
}

export function hasFeature(sub: Subscription, feature: Feature): boolean {
  return PLANS[effectivePlan(sub)].features.includes(feature);
}

export function trialDaysLeft(sub: Subscription, now = new Date()): number {
  return Math.max(0, Math.ceil((new Date(sub.trialEndsAt).getTime() - now.getTime()) / 86_400_000));
}

export const featureLabel: Record<Feature, string> = {
  fila: "Fila de atendimento",
  whatsapp: "Lembretes por WhatsApp",
  relatorios: "Relatórios",
  atendimentos: "Caixa de entrada unificada",
  unidades: "Várias unidades",
  api: "API",
};

export const featurePlan: Record<Feature, PlanTier> = {
  fila: "profissional",
  whatsapp: "profissional",
  relatorios: "profissional",
  atendimentos: "empresa",
  unidades: "empresa",
  api: "empresa",
};
