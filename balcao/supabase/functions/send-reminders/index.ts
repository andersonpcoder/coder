// Envia as mensagens automáticas pendentes: lembretes 24h/2h, aniversário e retorno.
// Agendada pelo pg_cron a cada 5 minutos (ver README).
import { sendEmail } from "../_shared/email.ts";
import { admin, json, safeEqual } from "../_shared/http.ts";
import { sendWhatsApp, sendWhatsAppTemplate, whatsappIntegration } from "../_shared/messaging.ts";

const PUBLIC_URL = Deno.env.get("PUBLIC_APP_URL") ?? "https://balcao.app";
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const fmt = (iso: string, tz: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: tz, ...opts }).format(new Date(iso));

const render = (template: string, vars: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

const subjects: Record<string, string> = {
  lembrete_24h: "Lembrete: seu horário é amanhã",
  lembrete_2h: "Seu horário é daqui a pouco",
  aniversario: "Feliz aniversário!",
  retorno: "Que tal agendar seu retorno?",
};

Deno.serve(async (req) => {
  if (CRON_SECRET && !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${CRON_SECRET}`)) {
    return new Response("Não autorizado", { status: 401 });
  }

  const { data: jobs, error } = await admin
    .from("notification_jobs")
    .select(`id, kind, channel, attempts, company_id,
      company:companies(name, timezone),
      appointment:appointments(starts_at, status, manage_token, service:services(name), professional:professionals(name)),
      customer:customers(name, phone, email)`)
    .eq("status", "pendente")
    .lte("scheduled_for", new Date().toISOString())
    .lt("attempts", 3)
    .order("scheduled_for")
    .limit(200);
  if (error) return json({ error: error.message }, 500);

  let sent = 0;
  const plans = new Map<string, string>();
  for (const job of jobs ?? []) {
    // deno-lint-ignore no-explicit-any
    const j = job as any;
    const mark = (patch: Record<string, unknown>) => admin.from("notification_jobs").update(patch).eq("id", j.id);
    try {
      const isReminder = j.kind === "lembrete_24h" || j.kind === "lembrete_2h";
      if (isReminder && (!j.appointment || ["cancelado", "faltou", "concluido"].includes(j.appointment.status))) {
        await mark({ status: "cancelado" });
        continue;
      }
      if (!plans.has(j.company_id)) {
        const { data } = await admin.rpc("effective_plan", { p_company: j.company_id });
        plans.set(j.company_id, data as string);
      }
      if (j.channel === "whatsapp" && plans.get(j.company_id) === "basico") {
        await mark({ status: "cancelado", last_error: "WhatsApp não incluído no plano Básico" });
        continue;
      }
      const { data: template } = await admin
        .from("message_templates")
        .select("body, provider_template, provider_params")
        .eq("company_id", j.company_id)
        .eq("kind", j.kind)
        .eq("channel", j.channel)
        .eq("active", true)
        .maybeSingle();
      if (!template) {
        await mark({ status: "cancelado", last_error: "Sem modelo ativo" });
        continue;
      }
      const tz = j.company?.timezone ?? "America/Sao_Paulo";
      const vars: Record<string, string> = {
        nome: String(j.customer?.name ?? "").split(" ")[0],
        empresa: j.company?.name ?? "",
        hora: j.appointment ? fmt(j.appointment.starts_at, tz, { hour: "2-digit", minute: "2-digit" }) : "",
        data: j.appointment ? fmt(j.appointment.starts_at, tz, { day: "2-digit", month: "2-digit" }) : "",
        servico: j.appointment?.service?.name ?? "",
        profissional: j.appointment?.professional?.name ?? "",
        link: isReminder ? `${PUBLIC_URL}/agendamento/${j.appointment.manage_token}` : PUBLIC_URL,
      };
      let text = render(template.body, vars);
      if (isReminder && !template.body.includes("{link}")) text += `\n\nConfirmar, remarcar ou cancelar: ${vars.link}`;

      if (j.channel === "whatsapp") {
        const integration = await whatsappIntegration(j.company_id);
        if (!integration) throw new Error("Nenhuma integração de WhatsApp ativa");
        if (!j.customer?.phone) throw new Error("Cliente sem telefone");
        if (integration.provider === "whatsapp_cloud" && template.provider_template) {
          const params = (template.provider_params ?? []).map((k: string) => vars[k] ?? "");
          await sendWhatsAppTemplate(integration, j.customer.phone, template.provider_template, params);
        } else {
          await sendWhatsApp(integration, j.customer.phone, text);
        }
      } else {
        if (!j.customer?.email) {
          await mark({ status: "cancelado", last_error: "Cliente sem e-mail" });
          continue;
        }
        await sendEmail(j.customer.email, `${subjects[j.kind] ?? "Aviso"} · ${j.company?.name ?? ""}`, text);
      }
      await mark({ status: "enviado", sent_at: new Date().toISOString(), attempts: j.attempts + 1 });
      sent++;
    } catch (e) {
      const attempts = j.attempts + 1;
      await mark({ attempts, last_error: String((e as Error).message).slice(0, 500), status: attempts >= 3 ? "falhou" : "pendente" });
    }
  }
  return json({ processados: jobs?.length ?? 0, enviados: sent });
});
