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

export interface Company {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  timezone: string;
  address: string;
  phone: string;
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
  initials: string;
  avatarHue: number;
  commissionPct: number;
  serviceIds: string[];
  workHours: WorkHours;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  durationMin: number;
  priceCents: number;
  color: ServiceColor;
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
}

export interface Payment {
  id: string;
  appointmentId?: string;
  customerId?: string;
  professionalId?: string;
  method: PaymentMethod;
  amountCents: number;
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
