// Webhook de mensagens recebidas pela Z-API ou pela Evolution API.
// URL: /functions/v1/whatsapp-webhook?provider=zapi|evolution&chave=<token de verificação>
import { admin } from "../_shared/http.ts";
import { handleInbound } from "../_shared/messaging.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider");
  const key = url.searchParams.get("chave") ?? "";
  if (req.method !== "POST" || !key || (provider !== "zapi" && provider !== "evolution")) {
    return new Response("Requisição inválida", { status: 400 });
  }
  const { data: integration } = await admin
    .from("integrations")
    .select("company_id")
    .eq("provider", provider)
    .eq("active", true)
    .eq("settings->>verify_token", key)
    .maybeSingle();
  if (!integration) return new Response("Chave inválida", { status: 403 });

  // deno-lint-ignore no-explicit-any
  const p = (await req.json()) as any;
  try {
    if (provider === "zapi") {
      if (!p.fromMe && !p.isGroup && p.phone) {
        const body = p.text?.message ?? p.buttonsResponseMessage?.message ?? p.listResponseMessage?.message ?? "[mídia]";
        await handleInbound({ companyId: integration.company_id, channel: "whatsapp", externalId: String(p.phone), name: p.senderName ?? p.chatName, body, externalMessageId: p.messageId });
      }
    } else if (p.event === "messages.upsert" || p.event === "MESSAGES_UPSERT") {
      const d = Array.isArray(p.data) ? p.data[0] : p.data;
      const jid: string = d?.key?.remoteJid ?? "";
      if (d && !d.key?.fromMe && jid.endsWith("@s.whatsapp.net")) {
        const body = d.message?.conversation ?? d.message?.extendedTextMessage?.text ?? "[mídia]";
        await handleInbound({ companyId: integration.company_id, channel: "whatsapp", externalId: jid.split("@")[0], name: d.pushName, body, externalMessageId: d.key?.id });
      }
    }
  } catch (e) {
    console.error(e);
  }
  return new Response("ok");
});
