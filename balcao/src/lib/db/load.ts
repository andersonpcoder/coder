import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, startOfDay } from "../dates";
import type { Dataset } from "../mock-data";
import type { Conversation, Subscription } from "../types";
import { formatAddress, fromRow, userFromMembership } from "./mappers";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

const PAGE = 1000;

/** Busca todas as linhas, página por página (a API limita a 1000 por chamada). */
async function all(build: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

export interface Membership {
  companyId: string;
  companyName: string;
  role: string;
}

export async function listMemberships(sb: SupabaseClient, userId: string): Promise<Membership[]> {
  const { data, error } = await sb
    .from("memberships")
    .select("company_id, role, companies(name)")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((m: Row) => ({ companyId: m.company_id, companyName: m.companies?.name ?? "", role: m.role }));
}

/** Carrega os dados de uma empresa. Agenda e pagamentos cobrem 13 meses para trás e 12 para frente. */
export async function loadCompany(sb: SupabaseClient, companyId: string): Promise<Dataset> {
  const since = addDays(startOfDay(new Date()), -400).toISOString();
  const until = addDays(startOfDay(new Date()), 370).toISOString();
  const today = startOfDay(new Date()).toISOString();
  const byCompany = (table: string, select = "*") => (from: number, to: number) =>
    sb.from(table).select(select).eq("company_id", companyId).range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: unknown }>;

  const [
    companyRes,
    subscriptionRes,
    units,
    memberships,
    professionals,
    hours,
    proServices,
    services,
    customers,
    appointments,
    blocks,
    queue,
    conversations,
    payments,
    notifications,
    templates,
    quickReplies,
  ] = await Promise.all([
    sb.from("companies").select("*").eq("id", companyId).single(),
    sb.from("subscriptions").select("*").eq("company_id", companyId).maybeSingle(),
    all(byCompany("units")),
    all(byCompany("memberships")),
    all(byCompany("professionals")),
    all(byCompany("work_hours")),
    all(byCompany("professional_services")),
    all(byCompany("services")),
    all(byCompany("customers")),
    all((f, t) => sb.from("appointments").select("*").eq("company_id", companyId).gte("starts_at", since).lte("starts_at", until).order("starts_at").range(f, t) as never),
    all((f, t) => sb.from("time_blocks").select("*").eq("company_id", companyId).gte("ends_at", since).range(f, t) as never),
    all((f, t) => sb.from("queue_entries").select("*").eq("company_id", companyId).gte("checked_in_at", today).range(f, t) as never),
    all((f, t) => sb.from("conversations").select("*").eq("company_id", companyId).order("last_message_at", { ascending: false }).range(f, t) as never),
    all((f, t) => sb.from("payments").select("*").eq("company_id", companyId).gte("paid_at", since).range(f, t) as never),
    all((f, t) => sb.from("internal_notifications").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).range(f, Math.min(t, f + 49)) as never),
    all(byCompany("message_templates")),
    all(byCompany("quick_replies")),
  ]);
  if (companyRes.error) throw companyRes.error;

  // Só o admin enxerga estas tabelas (RLS); para os demais voltam vazias.
  const [integrations, invites, apiKeys] = await Promise.all([
    all(byCompany("integrations", "id, provider, settings, active")).catch(() => []),
    all(byCompany("invites")).catch(() => []),
    all(byCompany("api_keys", "id, name, prefix, last_used_at, revoked_at, created_at")).catch(() => []),
  ]);

  // A tabela de assinatura é só do admin; os demais recebem apenas o plano em vigor.
  let subscription = subscriptionRes.data ? fromRow.subscription(subscriptionRes.data) : null;
  if (!subscription) {
    const { data: plan } = await sb.rpc("effective_plan", { p_company: companyId });
    subscription = { plan: (plan as Subscription["plan"]) ?? "basico", status: "ativa", trialEndsAt: new Date().toISOString() };
  }

  const userIds = memberships.map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await sb.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] as Row[] };

  // Mensagens das conversas abertas e das últimas 100.
  const recentConversationIds = conversations.slice(0, 100).map((c) => c.id);
  const messages = recentConversationIds.length
    ? await all((f, t) => sb.from("messages").select("*").in("conversation_id", recentConversationIds).order("created_at").range(f, t) as never)
    : [];

  const unitList = units.sort((a, b) => a.created_at.localeCompare(b.created_at)).map(fromRow.unit);
  const pros = professionals.map((p) => fromRow.professional(p, hours, proServices));
  const convs: Conversation[] = conversations.map((c) => ({
    ...fromRow.conversation(c),
    messages: messages.filter((m) => m.conversation_id === c.id).map(fromRow.message),
  }));

  return {
    company: fromRow.company(companyRes.data, unitList[0]),
    units: unitList,
    subscription,
    users: memberships.map((m) => userFromMembership(m, profiles ?? [], pros)),
    professionals: pros,
    services: services.map(fromRow.service),
    customers: customers.map(fromRow.customer),
    appointments: appointments.map(fromRow.appointment),
    blocks: blocks.map(fromRow.block),
    queue: queue.map(fromRow.queue),
    conversations: convs,
    payments: payments.map(fromRow.payment),
    notifications: notifications.map(fromRow.notification),
    templates: templates.map(fromRow.template),
    quickReplies: quickReplies.map(fromRow.quickReply),
    integrations: integrations.map(fromRow.integration),
    invites: invites.map(fromRow.invite),
    apiKeys: apiKeys.map(fromRow.apiKey),
  };
}

export { formatAddress };
