// Cancela a assinatura no provedor. O acesso segue até o fim do período pago.
import { admin, HttpError, json, requireAdmin, serve } from "../_shared/http.ts";
import { asaas, mercadopago, stripe } from "../_shared/billing.ts";

serve(async (req) => {
  const { company_id } = await req.json();
  await requireAdmin(req, company_id);
  const { data: sub } = await admin.from("subscriptions").select("*").eq("company_id", company_id).single();
  if (!sub) throw new HttpError(404, "Assinatura não encontrada");
  if (sub.provider_subscription_id) {
    if (sub.provider === "stripe") await stripe(`subscriptions/${sub.provider_subscription_id}`, { cancel_at_period_end: "true" });
    if (sub.provider === "asaas") await asaas(`subscriptions/${sub.provider_subscription_id}`, undefined, "DELETE");
    if (sub.provider === "mercadopago") await mercadopago(`preapproval/${sub.provider_subscription_id}`, { status: "cancelled" }, "PUT");
  }
  await admin.from("subscriptions").update({ status: "cancelada" }).eq("company_id", company_id);
  return json({ ok: true });
});
