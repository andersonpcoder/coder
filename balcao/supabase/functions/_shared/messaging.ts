// Envio e recebimento de mensagens: WhatsApp (Cloud API, Z-API, Evolution) e Instagram.
import { admin } from "./http.ts";

export interface IntegrationRow {
  id: string;
  company_id: string;
  provider: "whatsapp_cloud" | "zapi" | "evolution" | "instagram";
  settings: Record<string, string>;
  secret: string | null;
  active: boolean;
}

const GRAPH = "https://graph.facebook.com/v21.0";

/** Telefones são guardados sem o 55; os provedores esperam com o código do país. */
export const withCountry = (phone: string) => (phone.startsWith("55") && phone.length > 11 ? phone : `55${phone}`);
export const withoutCountry = (phone: string) => {
  const d = phone.replace(/\D/g, "");
  return d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
};

export async function whatsappIntegration(companyId: string): Promise<IntegrationRow | null> {
  const { data } = await admin
    .from("integrations")
    .select("*")
    .eq("company_id", companyId)
    .in("provider", ["whatsapp_cloud", "zapi", "evolution"])
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  return data as IntegrationRow | null;
}

export async function instagramIntegration(companyId: string): Promise<IntegrationRow | null> {
  const { data } = await admin.from("integrations").select("*").eq("company_id", companyId).eq("provider", "instagram").eq("active", true).maybeSingle();
  return data as IntegrationRow | null;
}

async function check(res: Response, label: string) {
  if (!res.ok) throw new Error(`${label} ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function sendWhatsApp(integration: IntegrationRow, phone: string, text: string): Promise<void> {
  const s = integration.settings;
  const to = withCountry(phone.replace(/\D/g, ""));
  if (!integration.secret) throw new Error("Token do WhatsApp não configurado");
  switch (integration.provider) {
    case "whatsapp_cloud": {
      // Fora da janela de 24h a Meta exige modelo aprovado (type "template").
      const res = await fetch(`${GRAPH}/${s.phone_number_id}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${integration.secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
      });
      return check(res, "WhatsApp Cloud API");
    }
    case "zapi": {
      const res = await fetch(`https://api.z-api.io/instances/${s.instance_id}/token/${integration.secret}/send-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(s.client_token ? { "Client-Token": s.client_token } : {}) },
        body: JSON.stringify({ phone: to, message: text }),
      });
      return check(res, "Z-API");
    }
    case "evolution": {
      const res = await fetch(`${s.base_url.replace(/\/$/, "")}/message/sendText/${s.instance}`, {
        method: "POST",
        headers: { apikey: integration.secret, "Content-Type": "application/json" },
        body: JSON.stringify({ number: to, text }),
      });
      return check(res, "Evolution API");
    }
    default:
      throw new Error("Provedor de WhatsApp inválido");
  }
}

/** Envio com modelo aprovado (WhatsApp Cloud API), obrigatório fora da janela de 24h. */
export async function sendWhatsAppTemplate(
  integration: IntegrationRow,
  phone: string,
  template: string,
  params: string[],
  language = "pt_BR",
): Promise<void> {
  if (integration.provider !== "whatsapp_cloud") throw new Error("Modelos só existem na API oficial");
  if (!integration.secret) throw new Error("Token do WhatsApp não configurado");
  const res = await fetch(`${GRAPH}/${integration.settings.phone_number_id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${integration.secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: withCountry(phone.replace(/\D/g, "")),
      type: "template",
      template: {
        name: template,
        language: { code: language },
        components: params.length ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text: text || "-" })) }] : [],
      },
    }),
  });
  return check(res, "WhatsApp Cloud API (modelo)");
}

export async function sendInstagram(integration: IntegrationRow, recipientId: string, text: string): Promise<void> {
  if (!integration.secret) throw new Error("Token do Instagram não configurado");
  const res = await fetch(`${GRAPH}/me/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${integration.secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  });
  return check(res, "Instagram");
}

const CONFIRM_WORDS = /^\s*(1|sim|confirmo|confirmado|ok|confirmar)\s*[.!]*\s*$/i;

/**
 * Registra uma mensagem recebida: cria cliente e conversa se preciso. Se a
 * resposta for "1" ou "sim" e houver agendamento nas próximas 48h, confirma.
 */
export async function handleInbound(input: {
  companyId: string;
  channel: "whatsapp" | "instagram";
  externalId: string;
  name?: string;
  body: string;
  externalMessageId?: string;
}): Promise<void> {
  const { companyId, channel, externalId } = input;
  if (input.externalMessageId) {
    const { data: dup } = await admin.from("messages").select("id").eq("company_id", companyId).eq("external_id", input.externalMessageId).maybeSingle();
    if (dup) return;
  }

  let { data: conversation } = await admin
    .from("conversations")
    .select("id, customer_id")
    .eq("company_id", companyId)
    .eq("channel", channel)
    .eq("external_id", externalId)
    .maybeSingle();

  if (!conversation) {
    let customerId: string | null = null;
    if (channel === "whatsapp") {
      const phone = withoutCountry(externalId);
      const { data: existing } = await admin.from("customers").select("id").eq("company_id", companyId).eq("phone", phone).maybeSingle();
      customerId = existing?.id ?? null;
      if (!customerId) {
        const { data: created } = await admin
          .from("customers")
          .insert({ company_id: companyId, name: input.name?.trim() || `WhatsApp ${phone}`, phone, tags: ["WhatsApp"] })
          .select("id")
          .single();
        customerId = created!.id;
      }
    } else {
      const { data: created } = await admin
        .from("customers")
        .insert({ company_id: companyId, name: input.name?.trim() || "Contato do Instagram", tags: ["Instagram"] })
        .select("id")
        .single();
      customerId = created!.id;
    }
    const { data: conv } = await admin
      .from("conversations")
      .insert({ company_id: companyId, customer_id: customerId, channel, external_id: externalId })
      .select("id, customer_id")
      .single();
    conversation = conv!;
  }

  await admin.from("messages").insert({
    company_id: companyId,
    conversation_id: conversation.id,
    direction: "entrada",
    body: input.body,
    external_id: input.externalMessageId ?? null,
  });

  if (CONFIRM_WORDS.test(input.body) && conversation.customer_id) {
    const { data: appt } = await admin
      .from("appointments")
      .select("id")
      .eq("customer_id", conversation.customer_id)
      .eq("status", "agendado")
      .gt("starts_at", new Date().toISOString())
      .lt("starts_at", new Date(Date.now() + 48 * 3600_000).toISOString())
      .order("starts_at")
      .limit(1)
      .maybeSingle();
    if (appt) {
      await admin.from("appointments").update({ status: "confirmado" }).eq("id", appt.id);
      await admin.from("messages").insert({ company_id: companyId, conversation_id: conversation.id, direction: "sistema", body: "Agendamento confirmado pelo cliente" });
    }
  }
}
