// Envia por e-mail o link de um convite de equipe criado em Configurações > Usuários.
import { escapeHtml, sendEmail } from "../_shared/email.ts";
import { admin, HttpError, json, requireAdmin, serve } from "../_shared/http.ts";

const PUBLIC_URL = Deno.env.get("PUBLIC_APP_URL") ?? "https://balcao.app";
const roleLabel: Record<string, string> = { admin: "administrador", recepcao: "recepção", profissional: "profissional" };

serve(async (req) => {
  const { invite_id, email } = await req.json();
  const { data: invite } = await admin
    .from("invites")
    .select("id, company_id, role, token, accepted_at, company:companies(name)")
    .eq("id", invite_id)
    .maybeSingle();
  if (!invite) throw new HttpError(404, "Convite não encontrado");
  const inviter = await requireAdmin(req, invite.company_id);
  if (invite.accepted_at) throw new HttpError(409, "Este convite já foi usado");
  const to = String(email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new HttpError(400, "E-mail inválido");

  await admin.from("invites").update({ email: to }).eq("id", invite.id);
  // deno-lint-ignore no-explicit-any
  const company = (invite.company as any)?.name ?? "sua empresa";
  const link = `${PUBLIC_URL}/convite/${invite.token}`;
  const who = String(inviter.user_metadata?.full_name ?? "A administração");
  await sendEmail(
    to,
    `Convite para a equipe de ${company} no Balcão`,
    `${who} convidou você para acessar o Balcão de ${company} como ${roleLabel[invite.role]}.\n\nCrie sua conta ou entre por este link: ${link}\n\nSe você não esperava este convite, ignore este e-mail.`,
    `<p>${escapeHtml(who)} convidou você para acessar o Balcão de <strong>${escapeHtml(company)}</strong> como ${roleLabel[invite.role]}.</p>
     <p><a href="${link}" style="display:inline-block;background:#0F6E63;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">Aceitar convite</a></p>
     <p style="color:#5e6763;font-size:13px">Se você não esperava este convite, ignore este e-mail.</p>`,
  );
  return json({ enviado: true });
});
