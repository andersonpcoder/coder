// Entrega no canal de origem uma resposta enviada pela caixa de entrada.
import { admin, HttpError, json, serve, userClient } from "../_shared/http.ts";
import { instagramIntegration, sendInstagram, sendWhatsApp, whatsappIntegration } from "../_shared/messaging.ts";

serve(async (req) => {
  const { message_id } = await req.json();
  // Lido com o JWT de quem chamou: o RLS garante que é da equipe da empresa.
  const { data: message } = await userClient(req)
    .from("messages")
    .select("id, body, direction, company_id, conversation_id")
    .eq("id", message_id)
    .maybeSingle();
  if (!message) throw new HttpError(404, "Mensagem não encontrada");
  if (message.direction !== "saida") return json({ enviado: false });

  const { data: conversation } = await admin
    .from("conversations")
    .select("channel, external_id, customer:customers(phone)")
    .eq("id", message.conversation_id)
    .single();
  if (!conversation) throw new HttpError(404, "Conversa não encontrada");

  // O chat do site lê as mensagens direto do banco.
  if (conversation.channel === "site") return json({ enviado: true });

  try {
    if (conversation.channel === "whatsapp") {
      const integration = await whatsappIntegration(message.company_id);
      if (!integration) throw new Error("Nenhuma integração de WhatsApp ativa");
      // deno-lint-ignore no-explicit-any
      const phone = conversation.external_id ?? (conversation.customer as any)?.phone;
      if (!phone) throw new Error("Cliente sem telefone");
      await sendWhatsApp(integration, phone, message.body);
    } else {
      const integration = await instagramIntegration(message.company_id);
      if (!integration) throw new Error("Instagram não configurado");
      await sendInstagram(integration, conversation.external_id!, message.body);
    }
    return json({ enviado: true });
  } catch (e) {
    // Avisa a equipe na própria conversa que a mensagem não saiu.
    await admin.from("messages").insert({
      company_id: message.company_id,
      conversation_id: message.conversation_id,
      direction: "sistema",
      body: `Falha ao enviar: ${String((e as Error).message).slice(0, 160)}`,
    });
    return json({ enviado: false, erro: String((e as Error).message) }, 502);
  }
});
