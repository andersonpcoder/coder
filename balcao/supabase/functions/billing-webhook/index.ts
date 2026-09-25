// Notificações dos provedores de cobrança. URL: /functions/v1/billing-webhook?provider=stripe|asaas|mercadopago
import { admin, hmacHex, safeEqual } from "../_shared/http.ts";
import { addMonths, asaas, isCycle, isPlan, mercadopago, splitReference } from "../_shared/billing.ts";

type Status = "ativa" | "inadimplente" | "cancelada";

async function update(
  companyId: string,
  patch: { plan?: string; status?: Status; current_period_end?: string; provider_subscription_id?: string; provider?: string; billing_cycle?: string },
) {
  if (patch.plan && !isPlan(patch.plan)) delete patch.plan;
  if (patch.billing_cycle && !isCycle(patch.billing_cycle)) delete patch.billing_cycle;
  for (const k of Object.keys(patch) as (keyof typeof patch)[]) if (patch[k] === undefined) delete patch[k];
  await admin.from("subscriptions").update(patch).eq("company_id", companyId);
}

Deno.serve(async (req) => {
  const provider = new URL(req.url).searchParams.get("provider");
  const raw = await req.text();
  try {
    if (provider === "stripe") return await stripeEvent(req, raw);
    if (provider === "asaas") return await asaasEvent(req, raw);
    if (provider === "mercadopago") return await mercadopagoEvent(req, raw);
    return new Response("Provedor inválido", { status: 400 });
  } catch (e) {
    console.error(e);
    return new Response("Erro", { status: 500 });
  }
});

async function stripeEvent(req: Request, raw: string) {
  const header = req.headers.get("stripe-signature") ?? "";
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const expected = await hmacHex(Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "", `${parts.t}.${raw}`);
  if (!parts.v1 || !safeEqual(expected, parts.v1) || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) {
    return new Response("Assinatura inválida", { status: 401 });
  }
  const event = JSON.parse(raw);
  const obj = event.data.object;
  switch (event.type) {
    case "checkout.session.completed": {
      const { companyId, plan, cycle } = splitReference(obj.client_reference_id);
      if (companyId) await update(companyId, { plan, billing_cycle: cycle, status: "ativa", provider: "stripe", provider_subscription_id: obj.subscription });
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const companyId = obj.metadata?.company_id;
      if (!companyId) break;
      const status: Status = event.type.endsWith("deleted") || obj.status === "canceled"
        ? "cancelada"
        : obj.status === "past_due" || obj.status === "unpaid"
          ? "inadimplente"
          : obj.cancel_at_period_end ? "cancelada" : "ativa";
      const periodEnd = obj.current_period_end ?? obj.items?.data?.[0]?.current_period_end;
      await update(companyId, {
        plan: obj.metadata?.plan,
        billing_cycle: obj.metadata?.cycle,
        status,
        provider_subscription_id: obj.id,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : undefined,
      });
      break;
    }
    case "invoice.payment_failed": {
      const { data } = await admin.from("subscriptions").select("company_id").eq("provider_subscription_id", obj.subscription).maybeSingle();
      if (data) await update(data.company_id, { status: "inadimplente" });
      break;
    }
  }
  return new Response("ok");
}

async function asaasEvent(req: Request, raw: string) {
  const token = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
  if (!token || !safeEqual(req.headers.get("asaas-access-token") ?? "", token)) return new Response("Token inválido", { status: 401 });
  const event = JSON.parse(raw);
  const payment = event.payment;
  const subscriptionId = payment?.subscription ?? event.subscription?.id;
  if (!subscriptionId) return new Response("ok");
  let { companyId, plan, cycle } = splitReference(payment?.externalReference ?? event.subscription?.externalReference);
  if (!companyId) {
    const sub = await asaas(`subscriptions/${subscriptionId}`);
    ({ companyId, plan, cycle } = splitReference(sub.externalReference));
  }
  if (!companyId) return new Response("ok");
  if (event.event === "PAYMENT_CONFIRMED" || event.event === "PAYMENT_RECEIVED") {
    await update(companyId, {
      plan,
      billing_cycle: cycle,
      status: "ativa",
      current_period_end: addMonths(new Date(payment.dueDate), cycle === "anual" ? 12 : 1).toISOString(),
    });
  } else if (event.event === "PAYMENT_OVERDUE") {
    await update(companyId, { status: "inadimplente" });
  } else if (event.event === "SUBSCRIPTION_DELETED" || event.event === "SUBSCRIPTION_INACTIVATED") {
    await update(companyId, { status: "cancelada" });
  }
  return new Response("ok");
}

async function mercadopagoEvent(req: Request, raw: string) {
  const url = new URL(req.url);
  const body = raw ? JSON.parse(raw) : {};
  const id = body.data?.id ?? url.searchParams.get("data.id");
  const secret = Deno.env.get("MP_WEBHOOK_SECRET");
  if (secret) {
    const sig = Object.fromEntries((req.headers.get("x-signature") ?? "").split(",").map((p) => p.trim().split("=") as [string, string]));
    const manifest = `id:${id};request-id:${req.headers.get("x-request-id")};ts:${sig.ts};`;
    if (!sig.v1 || !safeEqual(await hmacHex(secret, manifest), sig.v1)) return new Response("Assinatura inválida", { status: 401 });
  }
  if (!id) return new Response("ok");
  if (body.type === "subscription_preapproval") {
    const pre = await mercadopago(`preapproval/${id}`);
    const { companyId, plan, cycle } = splitReference(pre.external_reference);
    if (companyId) {
      const status: Status = pre.status === "authorized" ? "ativa" : pre.status === "cancelled" || pre.status === "paused" ? "cancelada" : "inadimplente";
      await update(companyId, { plan, billing_cycle: cycle, status, provider: "mercadopago", provider_subscription_id: pre.id, current_period_end: pre.next_payment_date ?? undefined });
    }
  } else if (body.type === "subscription_authorized_payment") {
    const pay = await mercadopago(`authorized_payments/${id}`);
    const pre = await mercadopago(`preapproval/${pay.preapproval_id}`);
    const { companyId, plan, cycle } = splitReference(pre.external_reference);
    if (companyId) {
      await update(companyId, { plan, billing_cycle: cycle, status: pay.status === "approved" || pay.payment?.status === "approved" ? "ativa" : "inadimplente", current_period_end: pre.next_payment_date ?? undefined });
    }
  }
  return new Response("ok");
}
