// Abre o pagamento da assinatura e devolve a URL para onde o navegador vai.
import { admin, HttpError, json, requireAdmin, serve } from "../_shared/http.ts";
import { asaas, isPlan, mercadopago, PLAN_NAMES, PRICES, provider, stripe } from "../_shared/billing.ts";

serve(async (req) => {
  const { company_id, plan, method, return_url, document } = await req.json();
  if (!isPlan(plan)) throw new HttpError(400, "Plano inválido");
  const user = await requireAdmin(req, company_id);
  const { data: company } = await admin.from("companies").select("name").eq("id", company_id).single();
  const { data: sub } = await admin.from("subscriptions").select("*").eq("company_id", company_id).single();
  if (!company || !sub) throw new HttpError(404, "Empresa não encontrada");
  const back = typeof return_url === "string" ? return_url : Deno.env.get("PUBLIC_APP_URL") + "/configuracoes?aba=plano";
  const reference = `${company_id}:${plan}`;

  if (provider === "stripe") {
    // Troca de plano numa assinatura já ativa: altera o preço direto.
    if (sub.provider === "stripe" && sub.provider_subscription_id && sub.status === "ativa") {
      const current = await stripe(`subscriptions/${sub.provider_subscription_id}`, {}, "GET");
      await stripe(`subscriptions/${sub.provider_subscription_id}`, {
        "items[0][id]": current.items.data[0].id,
        "items[0][price]": Deno.env.get(`STRIPE_PRICE_${plan.toUpperCase()}`)!,
        "metadata[plan]": plan,
        proration_behavior: "create_prorations",
      });
      await admin.from("subscriptions").update({ plan }).eq("company_id", company_id);
      return json({ url: back });
    }
    let customer = sub.provider === "stripe" ? sub.provider_customer_id : null;
    if (!customer) {
      const c = await stripe("customers", { email: user.email ?? "", name: company.name, "metadata[company_id]": company_id });
      customer = c.id;
      await admin.from("subscriptions").update({ provider: "stripe", provider_customer_id: customer }).eq("company_id", company_id);
    }
    const session = await stripe("checkout/sessions", {
      mode: "subscription",
      customer,
      "line_items[0][price]": Deno.env.get(`STRIPE_PRICE_${plan.toUpperCase()}`)!,
      "line_items[0][quantity]": "1",
      success_url: `${back}&pagamento=ok`,
      cancel_url: back,
      client_reference_id: reference,
      "subscription_data[metadata][company_id]": company_id,
      "subscription_data[metadata][plan]": plan,
      locale: "pt-BR",
    });
    return json({ url: session.url });
  }

  if (provider === "asaas") {
    let customer = sub.provider === "asaas" ? sub.provider_customer_id : null;
    if (!customer) {
      const c = await asaas("customers", { name: company.name, email: user.email, cpfCnpj: document || undefined, externalReference: company_id });
      customer = c.id;
    }
    if (sub.provider === "asaas" && sub.provider_subscription_id) {
      await asaas(`subscriptions/${sub.provider_subscription_id}`, undefined, "DELETE").catch(() => undefined);
    }
    const created = await asaas("subscriptions", {
      customer,
      billingType: method === "cartao" ? "CREDIT_CARD" : "PIX",
      value: PRICES[plan] / 100,
      nextDueDate: new Date().toISOString().slice(0, 10),
      cycle: "MONTHLY",
      description: `Balcão · plano ${PLAN_NAMES[plan]}`,
      externalReference: reference,
    });
    await admin.from("subscriptions").update({ provider: "asaas", provider_customer_id: customer, provider_subscription_id: created.id }).eq("company_id", company_id);
    const payments = await asaas(`subscriptions/${created.id}/payments`);
    return json({ url: payments.data?.[0]?.invoiceUrl ?? back });
  }

  // Mercado Pago: assinatura (preapproval) paga com cartão no checkout do MP.
  const pre = await mercadopago("preapproval", {
    reason: `Balcão · plano ${PLAN_NAMES[plan]}`,
    external_reference: reference,
    payer_email: user.email,
    back_url: back,
    auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: PRICES[plan] / 100, currency_id: "BRL" },
    status: "pending",
  });
  await admin.from("subscriptions").update({ provider: "mercadopago", provider_subscription_id: pre.id }).eq("company_id", company_id);
  return json({ url: pre.init_point });
});
