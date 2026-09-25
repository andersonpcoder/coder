// Webhook da Meta: mensagens recebidas no WhatsApp Cloud API e no Instagram.
// Configure a mesma URL e o token de verificação mostrados em Configurações.
import { admin, hmacHex, safeEqual } from "../_shared/http.ts";
import { handleInbound, type IntegrationRow } from "../_shared/messaging.ts";

const APP_SECRET = Deno.env.get("META_APP_SECRET");

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const token = url.searchParams.get("hub.verify_token") ?? "";
    const { data } = await admin
      .from("integrations")
      .select("id")
      .in("provider", ["whatsapp_cloud", "instagram"])
      .eq("settings->>verify_token", token)
      .limit(1);
    if (url.searchParams.get("hub.mode") === "subscribe" && token && data?.length) {
      return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
    }
    return new Response("Token inválido", { status: 403 });
  }

  const raw = await req.text();
  if (APP_SECRET) {
    const expected = `sha256=${await hmacHex(APP_SECRET, raw)}`;
    if (!safeEqual(expected, req.headers.get("x-hub-signature-256") ?? "")) return new Response("Assinatura inválida", { status: 401 });
  }

  // deno-lint-ignore no-explicit-any
  const payload = JSON.parse(raw) as any;
  try {
    if (payload.object === "whatsapp_business_account") {
      for (const entry of payload.entry ?? []) {
        for (const change of entry.changes ?? []) {
          const value = change.value ?? {};
          const phoneId = value.metadata?.phone_number_id;
          if (!value.messages?.length || !phoneId) continue;
          const integration = await findIntegration("whatsapp_cloud", "phone_number_id", phoneId);
          if (!integration) continue;
          for (const m of value.messages) {
            const body = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? `[${m.type}]`;
            const name = value.contacts?.find((c: { wa_id: string }) => c.wa_id === m.from)?.profile?.name;
            await handleInbound({ companyId: integration.company_id, channel: "whatsapp", externalId: m.from, name, body, externalMessageId: m.id });
          }
        }
      }
    } else if (payload.object === "instagram") {
      for (const entry of payload.entry ?? []) {
        const integration = await findIntegration("instagram", "account_id", String(entry.id));
        if (!integration) continue;
        for (const ev of entry.messaging ?? []) {
          if (!ev.message || ev.message.is_echo) continue;
          const name = await instagramName(integration, ev.sender.id);
          await handleInbound({
            companyId: integration.company_id,
            channel: "instagram",
            externalId: String(ev.sender.id),
            name,
            body: ev.message.text ?? "[anexo]",
            externalMessageId: ev.message.mid,
          });
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
  // A Meta reenvia se não receber 200; erros ficam no log.
  return new Response("ok", { status: 200 });
});

async function findIntegration(provider: string, key: string, value: string): Promise<IntegrationRow | null> {
  const { data } = await admin.from("integrations").select("*").eq("provider", provider).eq("active", true).eq(`settings->>${key}`, value).limit(1).maybeSingle();
  return data as IntegrationRow | null;
}

async function instagramName(integration: IntegrationRow, id: string): Promise<string | undefined> {
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${id}?fields=name,username`, { headers: { Authorization: `Bearer ${integration.secret}` } });
    const data = await res.json();
    return data.name ?? (data.username ? `@${data.username}` : undefined);
  } catch {
    return undefined;
  }
}
