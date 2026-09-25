// Edge Function: envia os lembretes pendentes (WhatsApp e e-mail).
// Agendada pelo pg_cron a cada 5 minutos (ver README). Usa a service role,
// então roda fora do RLS e deve ser chamada só pelo agendador.
import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN");
const WHATSAPP_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "Balcão <lembretes@balcao.app>";
const PUBLIC_URL = Deno.env.get("PUBLIC_APP_URL") ?? "https://balcao.app";
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", ...opts }).format(new Date(iso));

function render(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

async function sendWhatsApp(phone: string, body: string) {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) throw new Error("WhatsApp não configurado");
  const res = await fetch(`https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    // Fora da janela de 24h a Meta exige modelo aprovado; troque por type "template" em produção.
    body: JSON.stringify({ messaging_product: "whatsapp", to: `55${phone}`, type: "text", text: { body } }),
  });
  if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${await res.text()}`);
}

async function sendEmail(to: string, subject: string, text: string) {
  if (!RESEND_API_KEY) throw new Error("E-mail não configurado");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, text }),
  });
  if (!res.ok) throw new Error(`E-mail ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return new Response("Não autorizado", { status: 401 });
  }

  const { data: jobs, error } = await supabase
    .from("notification_jobs")
    .select(`id, kind, channel, attempts, company_id,
      appointment:appointments(starts_at, status, manage_token,
        service:services(name), professional:professionals(name)),
      customer:customers(name, phone, email)`)
    .eq("status", "pendente")
    .lte("scheduled_for", new Date().toISOString())
    .lt("attempts", 3)
    .limit(100);
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  for (const job of jobs ?? []) {
    // deno-lint-ignore no-explicit-any
    const j = job as any;
    try {
      if (!j.appointment || ["cancelado", "faltou"].includes(j.appointment.status)) {
        await supabase.from("notification_jobs").update({ status: "cancelado" }).eq("id", j.id);
        continue;
      }
      const { data: template } = await supabase
        .from("message_templates")
        .select("body")
        .eq("company_id", j.company_id)
        .eq("kind", j.kind)
        .eq("channel", j.channel)
        .eq("active", true)
        .maybeSingle();
      if (!template) {
        await supabase.from("notification_jobs").update({ status: "cancelado", last_error: "Sem modelo ativo" }).eq("id", j.id);
        continue;
      }
      const confirmLink = `${PUBLIC_URL}/confirmar/${j.appointment.manage_token}`;
      const text = render(template.body, {
        nome: j.customer.name.split(" ")[0],
        hora: fmt(j.appointment.starts_at, { hour: "2-digit", minute: "2-digit" }),
        data: fmt(j.appointment.starts_at, { day: "2-digit", month: "2-digit", year: "numeric" }),
        servico: j.appointment.service.name,
        profissional: j.appointment.professional.name,
      }) + `\n\nConfirmar ou remarcar: ${confirmLink}`;

      if (j.channel === "whatsapp") await sendWhatsApp(j.customer.phone, text);
      else if (j.customer.email) await sendEmail(j.customer.email, "Lembrete do seu horário", text);
      else throw new Error("Cliente sem e-mail");

      await supabase.from("notification_jobs").update({ status: "enviado", sent_at: new Date().toISOString() }).eq("id", j.id);
      sent++;
    } catch (e) {
      const attempts = j.attempts + 1;
      await supabase
        .from("notification_jobs")
        .update({ attempts, last_error: String(e), status: attempts >= 3 ? "falhou" : "pendente" })
        .eq("id", j.id);
    }
  }
  return Response.json({ processados: jobs?.length ?? 0, enviados: sent });
});
