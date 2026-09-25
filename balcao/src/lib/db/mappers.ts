// Conversão entre as linhas do Postgres (snake_case) e os tipos do app.

import type {
  ApiKey,
  Appointment,
  Company,
  Conversation,
  Customer,
  Integration,
  Invite,
  Message,
  MessageTemplate,
  Notification,
  Payment,
  Professional,
  QueueEntry,
  QuickReply,
  Service,
  Subscription,
  TimeBlock,
  Unit,
  User,
  WorkHours,
} from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

export interface Collections {
  appointments: Appointment;
  blocks: TimeBlock;
  customers: Customer;
  queue: QueueEntry;
  conversations: Conversation;
  payments: Payment;
  professionals: Professional;
  services: Service;
  units: Unit;
  notifications: Notification;
  templates: MessageTemplate;
  quickReplies: QuickReply;
  integrations: Integration;
  invites: Invite;
  apiKeys: ApiKey;
  users: User;
}
export type CollectionName = keyof Collections;

export const tableOf: Record<CollectionName, string> = {
  appointments: "appointments",
  blocks: "time_blocks",
  customers: "customers",
  queue: "queue_entries",
  conversations: "conversations",
  payments: "payments",
  professionals: "professionals",
  services: "services",
  units: "units",
  notifications: "internal_notifications",
  templates: "message_templates",
  quickReplies: "quick_replies",
  integrations: "integrations",
  invites: "invites",
  apiKeys: "api_keys",
  users: "memberships",
};

const undef = <T>(v: T | null | undefined): T | undefined => (v === null ? undefined : v);

const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

/** {"1": [{"inicio": "09:00", "fim": "18:00"}]} <-> WorkHours em minutos. */
export function hoursFromJson(json: Row | null): WorkHours {
  const wh: WorkHours = {};
  for (const [day, list] of Object.entries(json ?? {})) {
    wh[Number(day)] = (list as { inicio: string; fim: string }[]).map((w) => ({ start: toMin(w.inicio), end: toMin(w.fim) }));
  }
  return wh;
}
export function hoursToJson(wh: WorkHours): Row {
  const json: Row = {};
  for (const [day, list] of Object.entries(wh)) {
    if (list.length) json[day] = list.map((w) => ({ inicio: hhmm(w.start), fim: hhmm(w.end) }));
  }
  return json;
}

export function hueOf(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export const fromRow = {
  appointment: (r: Row): Appointment => ({
    id: r.id,
    professionalId: r.professional_id,
    serviceId: r.service_id,
    customerId: r.customer_id,
    start: new Date(r.starts_at).toISOString(),
    end: new Date(r.ends_at).toISOString(),
    status: r.status,
    channel: r.channel,
    priceCents: r.price_cents,
    notes: undef(r.notes),
    recurrenceId: undef(r.recurrence_id),
    unitId: undef(r.unit_id),
    manageToken: undef(r.manage_token),
  }),
  block: (r: Row): TimeBlock => ({
    id: r.id,
    professionalId: undef(r.professional_id),
    kind: r.kind,
    reason: undef(r.reason),
    start: new Date(r.starts_at).toISOString(),
    end: new Date(r.ends_at).toISOString(),
  }),
  customer: (r: Row): Customer => ({
    id: r.id,
    name: r.name,
    phone: r.phone ?? "",
    email: undef(r.email),
    birthDate: undef(r.birth_date),
    notes: undef(r.notes),
    tags: r.tags ?? [],
    createdAt: r.created_at,
    lgpdConsentAt: undef(r.lgpd_consent_at),
  }),
  queue: (r: Row): QueueEntry => ({
    id: r.id,
    ticket: r.ticket,
    customerName: r.customer_name,
    customerId: undef(r.customer_id),
    appointmentId: undef(r.appointment_id),
    serviceId: undef(r.service_id),
    professionalId: undef(r.professional_id),
    unitId: undef(r.unit_id),
    isWalkIn: r.is_walk_in,
    status: r.status,
    checkedInAt: r.checked_in_at,
    calledAt: undef(r.called_at),
    startedAt: undef(r.started_at),
    finishedAt: undef(r.finished_at),
  }),
  /** Sem a chave messages: as mensagens chegam por outra consulta. */
  conversation: (r: Row): Omit<Conversation, "messages"> => ({
    id: r.id,
    customerId: r.customer_id,
    channel: r.channel,
    status: r.status,
    assignedTo: undef(r.assigned_to),
    tags: r.tags ?? [],
    unread: r.unread_count,
    lastMessageAt: r.last_message_at,
  }),
  message: (r: Row): Message => ({
    id: r.id,
    direction: r.direction,
    body: r.body,
    at: r.created_at,
    authorId: undef(r.sent_by),
  }),
  payment: (r: Row): Payment => ({
    id: r.id,
    appointmentId: undef(r.appointment_id),
    customerId: undef(r.customer_id),
    professionalId: undef(r.professional_id),
    method: r.method,
    amountCents: r.amount_cents,
    commissionCents: r.commission_cents,
    paidAt: r.paid_at,
  }),
  professional: (r: Row, hours: Row[], services: Row[]): Professional => {
    const workHours: WorkHours = {};
    for (const h of hours.filter((x) => x.professional_id === r.id)) {
      (workHours[h.weekday] ??= []).push({ start: toMin(h.start_time), end: toMin(h.end_time) });
    }
    return {
      id: r.id,
      name: r.name,
      title: r.role_title ?? "",
      avatarHue: hueOf(r.name),
      commissionPct: Number(r.commission_pct),
      serviceIds: services.filter((x) => x.professional_id === r.id).map((x) => x.service_id),
      workHours,
      active: r.active,
      unitId: undef(r.unit_id),
      userId: undef(r.user_id),
    };
  },
  service: (r: Row): Service => ({
    id: r.id,
    name: r.name,
    category: r.category,
    durationMin: r.duration_min,
    priceCents: r.price_cents,
    color: r.color,
    active: r.active,
  }),
  unit: (r: Row): Unit => ({
    id: r.id,
    name: r.name,
    phone: undef(r.phone),
    addressLine: undef(r.address_line),
    city: undef(r.city),
    state: undef(r.state),
    postalCode: undef(r.postal_code),
    businessHours: hoursFromJson(r.business_hours),
  }),
  notification: (r: Row): Notification => ({
    id: r.id,
    title: r.title,
    body: r.body ?? "",
    at: r.created_at,
    read: !!r.read_at,
    link: undef(r.link),
  }),
  template: (r: Row): MessageTemplate => ({ id: r.id, kind: r.kind, channel: r.channel, body: r.body, active: r.active }),
  quickReply: (r: Row): QuickReply => ({ id: r.id, title: r.title, body: r.body }),
  integration: (r: Row): Integration => ({ id: r.id, provider: r.provider, settings: r.settings ?? {}, active: r.active }),
  invite: (r: Row): Invite => ({
    id: r.id,
    email: undef(r.email),
    role: r.role,
    professionalId: undef(r.professional_id),
    token: r.token,
    acceptedAt: undef(r.accepted_at),
    createdAt: r.created_at,
  }),
  apiKey: (r: Row): ApiKey => ({
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    lastUsedAt: undef(r.last_used_at),
    revokedAt: undef(r.revoked_at),
    createdAt: r.created_at,
  }),
  company: (r: Row, mainUnit?: Unit): Company => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    primaryColor: r.primary_color,
    timezone: r.timezone,
    segment: undef(r.segment),
    logoUrl: undef(r.logo_url),
    address: mainUnit ? formatAddress(mainUnit) : "",
    phone: mainUnit?.phone ?? "",
  }),
  subscription: (r: Row): Subscription => ({
    plan: r.plan,
    status: r.status,
    trialEndsAt: r.trial_ends_at,
    currentPeriodEnd: undef(r.current_period_end),
    provider: undef(r.provider),
  }),
};

export function formatAddress(u: Unit): string {
  return [u.addressLine, u.city && u.state ? `${u.city}, ${u.state}` : u.city].filter(Boolean).join(", ");
}

// Domínio -> linha. Chaves ausentes ficam de fora (útil para updates parciais);
// chaves presentes com undefined viram null.

const renames: Partial<Record<CollectionName, Record<string, string>>> = {
  appointments: { start: "starts_at", end: "ends_at" },
  blocks: { start: "starts_at", end: "ends_at" },
  conversations: { unread: "unread_count" },
  professionals: { title: "role_title" },
  notifications: { at: "created_at" },
};

const skipped: Partial<Record<CollectionName, string[]>> = {
  appointments: ["manageToken"],
  conversations: ["messages"],
  professionals: ["avatarHue", "serviceIds", "workHours"],
  notifications: ["read"],
  users: ["name", "professionalId"],
};

const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

export function toRow<C extends CollectionName>(collection: C, item: Partial<Collections[C]>): Row {
  const row: Row = {};
  for (const [key, value] of Object.entries(item)) {
    if (skipped[collection]?.includes(key)) continue;
    const column = renames[collection]?.[key] ?? snake(key);
    row[column] = value === undefined ? null : value;
  }
  if (collection === "units" && "businessHours" in item) {
    delete row.business_hours;
    row.business_hours = hoursToJson((item as Partial<Unit>).businessHours ?? {});
  }
  if (collection === "notifications" && "read" in item) {
    row.read_at = (item as Partial<Notification>).read ? new Date().toISOString() : null;
  }
  if (collection === "users") {
    delete row.id;
  }
  return row;
}

export function userFromMembership(m: Row, profiles: Row[], professionals: Professional[]): User {
  return {
    id: m.user_id,
    name: profiles.find((p) => p.id === m.user_id)?.full_name || "Usuário",
    role: m.role,
    professionalId: professionals.find((p) => p.userId === m.user_id)?.id,
  };
}
