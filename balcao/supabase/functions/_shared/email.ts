// E-mail transacional pelo Resend (https://resend.com).
import { HttpError } from "./http.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? "Balcão <nao-responda@balcao.app>";

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
  if (!RESEND_API_KEY) throw new HttpError(503, "E-mail não configurado (RESEND_API_KEY)");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, text, html }),
  });
  if (!res.ok) throw new HttpError(502, `Falha no envio do e-mail (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
