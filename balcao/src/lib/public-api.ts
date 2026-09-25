"use client";

// Acesso da página pública (cliente final, sem login). Com o Supabase usa as
// funções public_* do banco; na demonstração lê e grava os dados de exemplo
// guardados neste navegador.

import { addMinutes, startOfDay } from "./dates";
import { availableSlots } from "./scheduling";
import { createClient, errorMessage, isDemoMode } from "./supabase/client";
import type { Appointment, AppointmentStatus, Professional } from "./types";

export interface PublicService {
  id: string;
  name: string;
  category: string;
  durationMin: number;
  priceCents: number;
}

export interface PublicProfessional {
  id: string;
  name: string;
  title?: string;
  serviceIds: string[];
}

export interface PublicCompany {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  primaryColor: string;
  timezone: string;
  address?: string;
  phone?: string;
  services: PublicService[];
  professionals: PublicProfessional[];
}

export interface PublicAppointment {
  status: AppointmentStatus;
  start: string;
  end: string;
  priceCents: number;
  serviceId: string;
  service: string;
  durationMin: number;
  professionalId: string;
  professional: string;
  customer: string;
  company: string;
  slug: string;
  primaryColor: string;
  timezone: string;
  logoUrl?: string;
  address?: string;
}

export interface ChatMessage {
  direction: "entrada" | "saida";
  body: string;
  at: string;
}

export interface PublicApi {
  company(slug: string): Promise<PublicCompany | null>;
  /** Falso quando a assinatura da empresa está inativa. */
  isOpen(slug: string): Promise<boolean>;
  slots(slug: string, serviceId: string, professionalId: string, day: Date, ignoreToken?: string): Promise<Date[]>;
  book(input: { slug: string; serviceId: string; professionalId: string; start: Date; name: string; phone: string; consent: boolean }): Promise<string>;
  appointment(token: string): Promise<PublicAppointment | null>;
  confirm(token: string): Promise<void>;
  cancel(token: string): Promise<void>;
  reschedule(token: string, start: Date): Promise<void>;
  chatSend(slug: string, visitor: string, name: string, body: string): Promise<void>;
  chatMessages(visitor: string): Promise<ChatMessage[]>;
}

const dayParam = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* eslint-disable @typescript-eslint/no-explicit-any */
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createClient().rpc(fn, args);
  if (error) throw new Error(errorMessage(error));
  return data as T;
}

const supabaseApi: PublicApi = {
  isOpen: async (slug) => Boolean(await rpc<boolean>("public_booking_open", { p_slug: slug })),
  async company(slug) {
    const r = await rpc<any>("public_company", { p_slug: slug });
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      slug: r.slug,
      logoUrl: r.logo_url ?? undefined,
      primaryColor: r.primary_color,
      timezone: r.timezone ?? "America/Sao_Paulo",
      address: r.address || undefined,
      phone: r.phone ?? undefined,
      services: (r.services ?? []).map((s: any) => ({ id: s.id, name: s.name, category: s.category, durationMin: s.duration_min, priceCents: s.price_cents })),
      professionals: (r.professionals ?? []).map((p: any) => ({ id: p.id, name: p.name, title: p.role_title ?? undefined, serviceIds: p.service_ids ?? [] })),
    };
  },
  async slots(slug, serviceId, professionalId, day, ignoreToken) {
    const rows = await rpc<string[]>("public_available_slots", {
      p_slug: slug,
      p_service: serviceId,
      p_professional: professionalId,
      p_day: dayParam(day),
      p_ignore_token: ignoreToken ?? null,
    });
    return (rows ?? []).map((s) => new Date(s));
  },
  book: (i) =>
    rpc<string>("public_book", {
      p_slug: i.slug,
      p_service: i.serviceId,
      p_professional: i.professionalId,
      p_starts_at: i.start.toISOString(),
      p_name: i.name,
      p_phone: i.phone,
      p_consent: i.consent,
    }),
  async appointment(token) {
    const r = await rpc<any>("public_appointment", { p_token: token });
    if (!r) return null;
    return {
      status: r.status,
      start: r.starts_at,
      end: r.ends_at,
      priceCents: r.price_cents,
      serviceId: r.service_id,
      service: r.service,
      durationMin: r.duration_min,
      professionalId: r.professional_id,
      professional: r.professional,
      customer: r.customer,
      company: r.company,
      slug: r.slug,
      primaryColor: r.primary_color,
      timezone: r.timezone ?? "America/Sao_Paulo",
      logoUrl: r.logo_url ?? undefined,
      address: r.address || undefined,
    };
  },
  confirm: (token) => rpc("public_confirm", { p_token: token }),
  cancel: (token) => rpc("public_cancel", { p_token: token }),
  reschedule: (token, start) => rpc("public_reschedule", { p_token: token, p_starts_at: start.toISOString() }),
  chatSend: (slug, visitor, name, body) => rpc("public_chat_send", { p_slug: slug, p_visitor: visitor, p_name: name, p_body: body }),
  async chatMessages(visitor) {
    const rows = await rpc<any[]>("public_chat_messages", { p_visitor: visitor });
    return (rows ?? []).map((m) => ({ direction: m.direction, body: m.body, at: m.created_at }));
  },
};

// Demonstração -------------------------------------------------------------------

const DEMO_KEY = "balcao:demo:v2";

function readDemo(): any | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDemo(state: any) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(state));
  } catch {
    // Sem armazenamento: a mudança vale só nesta visita.
  }
}

function demoFor(slug: string) {
  const s = readDemo();
  if (!s || s.company.slug !== slug) throw new Error("Abra o painel da demonstração uma vez para carregar os dados de exemplo.");
  return s;
}

const demoApi: PublicApi = {
  isOpen: async () => true,
  async company(slug) {
    const s = readDemo();
    if (!s || s.company.slug !== slug) return null;
    return {
      id: s.company.id,
      name: s.company.name,
      slug: s.company.slug,
      primaryColor: s.company.primaryColor,
      timezone: s.company.timezone,
      address: s.company.address,
      phone: s.company.phone,
      logoUrl: s.company.logoUrl,
      services: s.services.filter((x: any) => x.active).map((x: any) => ({ id: x.id, name: x.name, category: x.category, durationMin: x.durationMin, priceCents: x.priceCents })),
      professionals: s.professionals.filter((p: any) => p.active).map((p: any) => ({ id: p.id, name: p.name, title: p.title, serviceIds: p.serviceIds })),
    };
  },
  async slots(slug, serviceId, professionalId, day, ignoreToken) {
    const s = demoFor(slug);
    const pro: Professional | undefined = s.professionals.find((p: Professional) => p.id === professionalId);
    const svc = s.services.find((x: any) => x.id === serviceId);
    if (!pro || !svc || !pro.serviceIds.includes(serviceId)) return [];
    const appts = s.appointments.filter((a: Appointment) => a.manageToken !== ignoreToken || !ignoreToken);
    return availableSlots(pro, startOfDay(day), svc.durationMin, appts, s.blocks);
  },
  async book(i) {
    if (!i.consent) throw new Error("É preciso aceitar o termo de consentimento (LGPD)");
    const s = demoFor(i.slug);
    const svc = s.services.find((x: any) => x.id === i.serviceId);
    const free = await demoApi.slots(i.slug, i.serviceId, i.professionalId, i.start);
    if (!free.some((d) => d.getTime() === i.start.getTime())) throw new Error("Horário não está mais disponível");
    const phone = i.phone.replace(/\D/g, "");
    let customer = s.customers.find((c: any) => c.phone === phone);
    if (!customer) {
      customer = { id: crypto.randomUUID(), name: i.name, phone, tags: ["Novo"], createdAt: new Date().toISOString(), lgpdConsentAt: new Date().toISOString() };
      s.customers.push(customer);
    }
    const token = crypto.randomUUID().replace(/-/g, "");
    s.appointments.push({
      id: crypto.randomUUID(),
      professionalId: i.professionalId,
      serviceId: i.serviceId,
      customerId: customer.id,
      start: i.start.toISOString(),
      end: addMinutes(i.start, svc.durationMin).toISOString(),
      status: "agendado",
      channel: "site",
      priceCents: svc.priceCents,
      manageToken: token,
    });
    s.notifications.unshift({ id: crypto.randomUUID(), title: "Novo agendamento pelo site", body: `${i.name} agendou ${svc.name}`, at: new Date().toISOString(), read: false, link: "/agenda" });
    writeDemo(s);
    return token;
  },
  async appointment(token) {
    const s = readDemo();
    const a = s?.appointments.find((x: Appointment) => x.manageToken === token);
    if (!a) return null;
    const svc = s.services.find((x: any) => x.id === a.serviceId);
    const pro = s.professionals.find((x: any) => x.id === a.professionalId);
    const cu = s.customers.find((x: any) => x.id === a.customerId);
    return {
      status: a.status, start: a.start, end: a.end, priceCents: a.priceCents,
      serviceId: a.serviceId, service: svc?.name ?? "", durationMin: svc?.durationMin ?? 30,
      professionalId: a.professionalId, professional: pro?.name ?? "", customer: (cu?.name ?? "").split(" ")[0],
      company: s.company.name, slug: s.company.slug, primaryColor: s.company.primaryColor, timezone: s.company.timezone, address: s.company.address,
    };
  },
  async confirm(token) {
    const s = readDemo();
    const a = s?.appointments.find((x: Appointment) => x.manageToken === token);
    if (a?.status === "agendado") a.status = "confirmado";
    writeDemo(s);
  },
  async cancel(token) {
    const s = readDemo();
    const a = s?.appointments.find((x: Appointment) => x.manageToken === token);
    if (a && ["agendado", "confirmado"].includes(a.status)) a.status = "cancelado";
    writeDemo(s);
  },
  async reschedule(token, start) {
    const s = readDemo();
    const a = s?.appointments.find((x: Appointment) => x.manageToken === token);
    if (!a) throw new Error("Agendamento não encontrado");
    const free = await demoApi.slots(s.company.slug, a.serviceId, a.professionalId, start, token);
    if (!free.some((d) => d.getTime() === start.getTime())) throw new Error("Horário não está mais disponível");
    const duration = new Date(a.end).getTime() - new Date(a.start).getTime();
    const fresh = readDemo();
    const target = fresh.appointments.find((x: Appointment) => x.manageToken === token);
    target.start = start.toISOString();
    target.end = new Date(start.getTime() + duration).toISOString();
    target.status = "agendado";
    writeDemo(fresh);
  },
  async chatSend(slug, visitor, name, body) {
    const s = demoFor(slug);
    let conv = s.conversations.find((c: any) => c.visitor === visitor);
    const now = new Date().toISOString();
    if (!conv) {
      const customer = { id: crypto.randomUUID(), name: name || "Visitante do site", phone: "", tags: ["Site"], createdAt: now };
      s.customers.push(customer);
      conv = { id: crypto.randomUUID(), visitor, customerId: customer.id, channel: "site", status: "aberta", tags: [], unread: 0, messages: [{ id: crypto.randomUUID(), direction: "sistema", body: "Conversa iniciada pelo chat do site", at: now }], lastMessageAt: now };
      s.conversations.push(conv);
    }
    conv.messages.push({ id: crypto.randomUUID(), direction: "entrada", body, at: now });
    conv.unread += 1;
    conv.status = "aberta";
    conv.lastMessageAt = now;
    writeDemo(s);
  },
  async chatMessages(visitor) {
    const s = readDemo();
    const conv = s?.conversations.find((c: any) => c.visitor === visitor);
    return (conv?.messages ?? []).filter((m: any) => m.direction !== "sistema").map((m: any) => ({ direction: m.direction, body: m.body, at: m.at }));
  },
};

export function publicApi(): PublicApi {
  return isDemoMode() ? demoApi : supabaseApi;
}
