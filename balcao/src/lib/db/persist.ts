import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Professional, User } from "../types";
import { tableOf, toRow, type CollectionName, type Collections } from "./mappers";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Mudanças que o estado local aplica e que precisam ser gravadas no banco. */
export type Mutation =
  | { kind: "upsert"; collection: CollectionName; items: Collections[CollectionName][] }
  | { kind: "patch"; collection: CollectionName; id: string; patch: Record<string, unknown>; after?: unknown }
  | { kind: "remove"; collection: CollectionName; ids: string[] }
  | { kind: "message"; conversationId: string; message: { id: string; direction: string; body: string; at: string; authorId?: string } }
  | { kind: "company"; patch: Partial<Company> }
  | { kind: "readNotifications"; ids: string[] };

async function check<T extends { error: any }>(p: PromiseLike<T>): Promise<T> {
  const res = await p;
  if (res.error) throw res.error;
  return res;
}

async function saveProfessional(sb: SupabaseClient, companyId: string, pro: Professional) {
  await check(sb.from("professionals").upsert({ ...toRow("professionals", pro), company_id: companyId }));
  await check(sb.from("work_hours").delete().eq("professional_id", pro.id));
  const hours = Object.entries(pro.workHours).flatMap(([day, list]) =>
    list.map((w) => ({
      company_id: companyId,
      professional_id: pro.id,
      weekday: Number(day),
      start_time: `${Math.floor(w.start / 60)}:${w.start % 60}`,
      end_time: `${Math.floor(w.end / 60)}:${w.end % 60}`,
    })),
  );
  if (hours.length) await check(sb.from("work_hours").insert(hours));
  await check(sb.from("professional_services").delete().eq("professional_id", pro.id));
  if (pro.serviceIds.length) {
    await check(
      sb.from("professional_services").insert(
        pro.serviceIds.map((serviceId) => ({ company_id: companyId, professional_id: pro.id, service_id: serviceId })),
      ),
    );
  }
}

export async function persist(sb: SupabaseClient, companyId: string, m: Mutation): Promise<void> {
  switch (m.kind) {
    case "upsert": {
      if (m.collection === "professionals") {
        for (const pro of m.items as Professional[]) await saveProfessional(sb, companyId, pro);
        return;
      }
      if (m.collection === "users") {
        for (const u of m.items as User[]) {
          await check(sb.from("memberships").update({ role: u.role }).eq("company_id", companyId).eq("user_id", u.id));
        }
        return;
      }
      const rows: Record<string, unknown>[] = m.items.map((item) => ({ ...toRow(m.collection, item as never), company_id: companyId }));
      if (m.collection === "conversations") {
        for (const r of rows) delete r.last_message_at;
      }
      await check(sb.from(tableOf[m.collection]).upsert(rows));
      return;
    }
    case "patch": {
      if (m.collection === "professionals" && m.after) {
        await saveProfessional(sb, companyId, m.after as Professional);
        return;
      }
      if (m.collection === "users") {
        await check(sb.from("memberships").update({ role: m.patch.role }).eq("company_id", companyId).eq("user_id", m.id));
        return;
      }
      const row = toRow(m.collection, m.patch as never);
      if (!Object.keys(row).length) return;
      await check(sb.from(tableOf[m.collection]).update(row).eq("id", m.id));
      return;
    }
    case "remove": {
      if (m.collection === "users") {
        await check(sb.from("memberships").delete().eq("company_id", companyId).in("user_id", m.ids));
        return;
      }
      await check(sb.from(tableOf[m.collection]).delete().in("id", m.ids));
      return;
    }
    case "message": {
      const { data } = await sb.auth.getUser();
      await check(
        sb.from("messages").insert({
          id: m.message.id,
          company_id: companyId,
          conversation_id: m.conversationId,
          direction: m.message.direction,
          body: m.message.body,
          sent_by: m.message.direction === "saida" ? data.user?.id : null,
          created_at: m.message.at,
        }),
      );
      // Entrega a resposta no canal de origem (WhatsApp, Instagram). O chat do
      // site lê direto do banco, então não precisa de envio.
      if (m.message.direction === "saida") {
        sb.functions.invoke("send-message", { body: { message_id: m.message.id } }).catch(() => undefined);
      }
      return;
    }
    case "company": {
      const row: Record<string, unknown> = {};
      const map: Record<string, string> = { name: "name", slug: "slug", primaryColor: "primary_color", timezone: "timezone", segment: "segment", logoUrl: "logo_url" };
      for (const [k, v] of Object.entries(m.patch)) if (map[k]) row[map[k]] = v ?? null;
      if (Object.keys(row).length) await check(sb.from("companies").update(row).eq("id", companyId));
      return;
    }
    case "readNotifications": {
      if (m.ids.length) {
        await check(sb.from("internal_notifications").update({ read_at: new Date().toISOString() }).in("id", m.ids));
      }
      return;
    }
  }
}
