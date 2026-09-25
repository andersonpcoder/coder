// Tipos de domínio espelhando as tabelas do Supabase (supabase/migrations).

export type Role = "admin" | "recepcao" | "profissional";

export type AppointmentStatus =
  | "agendado"
  | "confirmado"
  | "aguardando"
  | "em_atendimento"
  | "concluido"
  | "faltou"
  | "cancelado";

export type BookingChannel = "whatsapp" | "instagram" | "site" | "presencial" | "telefone";
export type ConversationChannel = "whatsapp" | "instagram" | "site";
export type ServiceColor = "lavanda" | "ceu" | "menta" | "pessego" | "rosa" | "areia";
export type Recurrence = "nenhuma" | "semanal" | "quinzenal" | "mensal";
export type TimeBlockKind = "almoco" | "folga" | "feriado" | "outro";
export type QueueStatus = "aguardando" | "chamado" | "em_atendimento" | "concluido" | "desistiu";
export type PaymentMethod = "pix" | "dinheiro" | "cartao_credito" | "cartao_debito";
export type PlanTier = "basico" | "profissional" | "empresa";
export type SubscriptionStatus = "teste" | "ativa" | "inadimplente" | "cancelada";
export type NotificationKind = "lembrete_24h" | "lembrete_2h" | "confirmacao" | "aniversario" | "retorno" | "cancelamento";
export type NotificationChannel = "whatsapp" | "email";
export type IntegrationProvider = "whatsapp_cloud" | "zapi" | "evolution" | "instagram";

export interface Company {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  timezone: string;
  segment?: string;
  logoUrl?: string;
  /** Endereço e telefone vêm da unidade principal. */
  address: string;
  phone: string;
}

export interface Unit {
  id: string;
  name: string;
  phone?: string;
  addressLine?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  /** Horário de funcionamento em minutos, indexado pelo dia da semana. */
  businessHours: WorkHours;
}

export interface Subscription {
  plan: PlanTier;
  status: SubscriptionStatus;
  trialEndsAt: string;
  currentPeriodEnd?: string;
  billingCycle?: "mensal" | "anual";
  provider?: string;
}

export interface MessageTemplate {
  id: string;
  kind: NotificationKind;
  channel: NotificationChannel;
  body: string;
  active: boolean;
  /** Nome do modelo aprovado na Meta (só WhatsApp Cloud API). */
  providerTemplate?: string;
  /** Variáveis do Balcão na ordem dos parâmetros {{1}}, {{2}}... do modelo. */
  providerParams?: string[];
}

export interface QuickReply {
  id: string;
  title: string;
  body: string;
}

export interface Integration {
  id: string;
  provider: IntegrationProvider;
  settings: Record<string, string>;
  active: boolean;
}

export interface Invite {
  id: string;
  email?: string;
  role: Role;
  professionalId?: string;
  token: string;
  acceptedAt?: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  /** Só enviado na criação; o banco guarda apenas o hash. */
  keyHash?: string;
  lastUsedAt?: string;
  revokedAt?: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  /** Preenchido quando o usuário também é profissional. */
  professionalId?: string;
}

/** Janela de trabalho em minutos desde a meia-noite, indexada pelo dia da semana (0 = domingo). */
export type WorkHours = Record<number, { start: number; end: number }[]>;

export interface Professional {
  id: string;
  name: string;
  title: string;
  avatarHue: number;
  commissionPct: number;
  serviceIds: string[];
  workHours: WorkHours;
  active: boolean;
  unitId?: string;
  userId?: string;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  durationMin: number;
  priceCents: number;
  color: ServiceColor;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  birthDate?: string;
  notes?: string;
  tags: string[];
  createdAt: string;
  lgpdConsentAt?: string;
}

export interface Appointment {
  id: string;
  professionalId: string;
  serviceId: string;
  customerId: string;
  /** ISO 8601. */
  start: string;
  end: string;
  status: AppointmentStatus;
  channel: BookingChannel;
  priceCents: number;
  notes?: string;
  recurrenceId?: string;
  unitId?: string;
  manageToken?: string;
}

export interface TimeBlock {
  id: string;
  /** Sem profissional o bloqueio vale para todos (ex.: feriado). */
  professionalId?: string;
  kind: TimeBlockKind;
  reason?: string;
  start: string;
  end: string;
}

export interface QueueEntry {
  id: string;
  ticket: string;
  customerName: string;
  customerId?: string;
  appointmentId?: string;
  serviceId?: string;
  professionalId?: string;
  isWalkIn: boolean;
  status: QueueStatus;
  checkedInAt: string;
  unitId?: string;
  calledAt?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface Message {
  id: string;
  direction: "entrada" | "saida" | "sistema";
  body: string;
  at: string;
  authorId?: string;
}

export interface Conversation {
  id: string;
  customerId: string;
  channel: ConversationChannel;
  status: "aberta" | "resolvida";
  assignedTo?: string;
  tags: string[];
  unread: number;
  messages: Message[];
  lastMessageAt: string;
}

export interface Payment {
  id: string;
  appointmentId?: string;
  customerId?: string;
  professionalId?: string;
  method: PaymentMethod;
  amountCents: number;
  commissionCents?: number;
  paidAt: string;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  link?: string;
}
