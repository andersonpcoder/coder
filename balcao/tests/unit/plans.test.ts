import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { effectivePlan, hasFeature, PLANS, trialDaysLeft } from "@/lib/plans";
import type { Subscription } from "@/lib/types";

const now = new Date("2031-01-10T12:00:00Z");
const sub = (s: Partial<Subscription>): Subscription => ({ plan: "basico", status: "ativa", trialEndsAt: now.toISOString(), ...s });

describe("effectivePlan", () => {
  it("teste grátis vale como Empresa até acabar", () => {
    expect(effectivePlan(sub({ status: "teste", trialEndsAt: "2031-01-20T00:00:00Z" }), now)).toBe("empresa");
    expect(effectivePlan(sub({ status: "teste", trialEndsAt: "2031-01-01T00:00:00Z" }), now)).toBe("basico");
  });

  it("ativa e inadimplente mantêm o plano; cancelada só até o fim do período", () => {
    expect(effectivePlan(sub({ plan: "profissional" }), now)).toBe("profissional");
    expect(effectivePlan(sub({ plan: "empresa", status: "inadimplente" }), now)).toBe("empresa");
    expect(effectivePlan(sub({ plan: "empresa", status: "cancelada", currentPeriodEnd: "2031-02-01T00:00:00Z" }), now)).toBe("empresa");
    expect(effectivePlan(sub({ plan: "empresa", status: "cancelada", currentPeriodEnd: "2031-01-01T00:00:00Z" }), now)).toBe("basico");
  });

  it("recursos por plano", () => {
    expect(hasFeature(sub({ plan: "basico" }), "fila")).toBe(false);
    expect(hasFeature(sub({ plan: "profissional" }), "relatorios")).toBe(true);
    expect(hasFeature(sub({ plan: "profissional" }), "atendimentos")).toBe(false);
  });

  it("dias restantes do teste", () => {
    expect(trialDaysLeft(sub({ status: "teste", trialEndsAt: "2031-01-12T12:00:00Z" }), now)).toBe(2);
  });
});

describe("preços", () => {
  it("o app e a função de cobrança usam os mesmos valores", () => {
    const billing = fs.readFileSync(path.join(__dirname, "../../supabase/functions/_shared/billing.ts"), "utf8");
    for (const plan of Object.values(PLANS)) {
      expect(billing).toMatch(new RegExp(`${plan.tier}: ${plan.priceCents}\\b`));
    }
  });
});
