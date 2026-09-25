// Cobrança recorrente: Stripe, Asaas ou Mercado Pago (variável BILLING_PROVIDER).
export type Plan = "basico" | "profissional" | "empresa";
export type Provider = "stripe" | "asaas" | "mercadopago";

/** Preço mensal em centavos. Mantenha igual a src/lib/plans.ts. */
export const PRICES: Record<Plan, number> = { basico: 1990, profissional: 3990, empresa: 7990 };
export const PLAN_NAMES: Record<Plan, string> = { basico: "Básico", profissional: "Profissional", empresa: "Empresa" };

/** Plano anual: paga 10 meses e usa 12. Mantenha igual a src/lib/plans.ts. */
export const ANNUAL_MONTHS_CHARGED = 10;
export type Cycle = "mensal" | "anual";
export const isCycle = (v: unknown): v is Cycle => v === "mensal" || v === "anual";

/** Valor cobrado por ciclo, em centavos. */
export const priceFor = (plan: Plan, cycle: Cycle) => (cycle === "anual" ? PRICES[plan] * ANNUAL_MONTHS_CHARGED : PRICES[plan]);

/** Referência gravada no provedor: empresa:plano:ciclo. */
export function splitReference(ref?: string | null): { companyId?: string; plan?: string; cycle?: Cycle } {
  const [companyId, plan, cycle] = (ref ?? "").split(":");
  return { companyId: companyId || undefined, plan, cycle: isCycle(cycle) ? cycle : undefined };
}

export const provider = (Deno.env.get("BILLING_PROVIDER") ?? "stripe") as Provider;

export const isPlan = (v: unknown): v is Plan => v === "basico" || v === "profissional" || v === "empresa";

// Stripe -----------------------------------------------------------------------

export async function stripe(path: string, params: Record<string, string> = {}, method = "POST") {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${Deno.env.get("STRIPE_SECRET_KEY")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "GET" ? undefined : new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe: ${data.error?.message ?? res.status}`);
  return data;
}

// Asaas ------------------------------------------------------------------------

const ASAAS_URL = Deno.env.get("ASAAS_BASE_URL") ?? "https://api.asaas.com/v3";

export async function asaas(path: string, body?: unknown, method = body ? "POST" : "GET") {
  const res = await fetch(`${ASAAS_URL}/${path}`, {
    method,
    headers: { access_token: Deno.env.get("ASAAS_API_KEY") ?? "", "Content-Type": "application/json", "User-Agent": "balcao" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Asaas: ${data.errors?.[0]?.description ?? res.status}`);
  return data;
}

// Mercado Pago -------------------------------------------------------------------

export async function mercadopago(path: string, body?: unknown, method = body ? "POST" : "GET") {
  const res = await fetch(`https://api.mercadopago.com/${path}`, {
    method,
    headers: { Authorization: `Bearer ${Deno.env.get("MP_ACCESS_TOKEN")}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Mercado Pago: ${data.message ?? res.status}`);
  return data;
}

export const addMonths = (d: Date, n: number) => {
  const r = new Date(d);
  r.setMonth(r.getMonth() + n);
  return r;
};
