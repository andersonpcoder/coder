// API pública do plano Empresa. Autenticação: Authorization: Bearer <chave criada em Configurações>.
import { admin, HttpError, json, serve, sha256Hex } from "../_shared/http.ts";

async function authenticate(req: Request): Promise<{ companyId: string; slug: string }> {
  const key = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!key.startsWith("blc_")) throw new HttpError(401, "Chave de API ausente ou inválida");
  const { data } = await admin.from("api_keys").select("id, company_id, revoked_at, company:companies(slug)").eq("key_hash", await sha256Hex(key)).maybeSingle();
  if (!data || data.revoked_at) throw new HttpError(401, "Chave de API inválida ou revogada");
  const { data: plan } = await admin.rpc("effective_plan", { p_company: data.company_id });
  if (plan !== "empresa") throw new HttpError(403, "A API está disponível no plano Empresa");
  await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  // deno-lint-ignore no-explicit-any
  return { companyId: data.company_id, slug: (data.company as any).slug };
}

serve(async (req) => {
  const { companyId, slug } = await authenticate(req);
  const url = new URL(req.url);
  const route = url.pathname.replace(/^.*\/api/, "").replace(/\/$/, "");
  const q = url.searchParams;

  if (req.method === "GET" && route === "/agendamentos") {
    const from = q.get("de") ?? new Date().toISOString().slice(0, 10);
    const to = q.get("ate") ?? from;
    const { data, error } = await admin
      .from("appointments")
      .select("id, starts_at, ends_at, status, channel, price_cents, notes, service:services(id, name), professional:professionals(id, name), customer:customers(id, name, phone, email)")
      .eq("company_id", companyId)
      .gte("starts_at", `${from}T00:00:00-03:00`)
      .lte("starts_at", `${to}T23:59:59-03:00`)
      .order("starts_at")
      .limit(1000);
    if (error) throw new HttpError(400, error.message);
    return json({ dados: data });
  }

  if (req.method === "GET" && route === "/clientes") {
    let query = admin.from("customers").select("id, name, phone, email, birth_date, tags, created_at").eq("company_id", companyId).order("name").limit(200);
    const term = q.get("busca");
    if (term) query = query.or(`name.ilike.%${term.replace(/[%,()]/g, "")}%,phone.ilike.%${term.replace(/\D/g, "") || "x"}%`);
    const { data, error } = await query;
    if (error) throw new HttpError(400, error.message);
    return json({ dados: data });
  }

  if (req.method === "GET" && route === "/horarios") {
    const { data, error } = await admin.rpc("public_available_slots", {
      p_slug: slug,
      p_service: q.get("servico_id"),
      p_professional: q.get("profissional_id"),
      p_day: q.get("dia"),
    });
    if (error) throw new HttpError(400, error.message);
    return json({ dados: data });
  }

  if (req.method === "POST" && route === "/agendamentos") {
    const body = await req.json();
    const phone = String(body.cliente?.telefone ?? "").replace(/\D/g, "");
    if (!body.servico_id || !body.profissional_id || !body.inicio || !body.cliente?.nome) {
      throw new HttpError(400, "Informe servico_id, profissional_id, inicio e cliente.nome");
    }
    const { data: service } = await admin.from("services").select("duration_min, price_cents").eq("id", body.servico_id).eq("company_id", companyId).maybeSingle();
    if (!service) throw new HttpError(404, "Serviço não encontrado");
    let customerId: string | undefined;
    if (phone) {
      const { data: found } = await admin.from("customers").select("id").eq("company_id", companyId).eq("phone", phone).maybeSingle();
      customerId = found?.id;
    }
    if (!customerId) {
      const { data: created, error } = await admin
        .from("customers")
        .insert({ company_id: companyId, name: body.cliente.nome, phone: phone || null, email: body.cliente.email ?? null })
        .select("id")
        .single();
      if (error) throw new HttpError(400, error.message);
      customerId = created.id;
    }
    const start = new Date(body.inicio);
    const { data, error } = await admin
      .from("appointments")
      .insert({
        company_id: companyId,
        professional_id: body.profissional_id,
        service_id: body.servico_id,
        customer_id: customerId,
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + service.duration_min * 60_000).toISOString(),
        price_cents: service.price_cents,
        channel: "site",
        notes: body.observacoes ?? null,
      })
      .select("id, manage_token")
      .single();
    if (error) throw new HttpError(error.message.includes("appointments_no_overlap") ? 409 : 400, error.message.includes("appointments_no_overlap") ? "Horário indisponível" : error.message);
    return json({ dados: data }, 201);
  }

  throw new HttpError(404, "Rota não encontrada");
});
