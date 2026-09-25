import type {
  AppointmentStatus,
  BookingChannel,
  PaymentMethod,
  TimeBlockKind,
} from "./types";

// Datas no formato brasileiro. Os cálculos e a exibição usam o fuso do
// dispositivo, que para o público do Balcão é o horário de Brasília; o fuso da
// empresa (companies.timezone) é aplicado no servidor.

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function money(cents: number): string {
  return brl.format(cents / 100);
}

let displayTimeZone: string | undefined;

/**
 * Fixa o fuso de exibição. A página pública usa o fuso da empresa, para o
 * cliente ver o horário do estabelecimento mesmo estando em outro estado.
 */
export function setDisplayTimeZone(tz: string | undefined) {
  displayTimeZone = tz;
}

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function fmt(date: Date | string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", displayTimeZone ? { ...options, timeZone: displayTimeZone } : options).format(
    typeof date === "string" ? new Date(date) : date,
  );
}

/** 25/09/2026 */
export const formatDate = (d: Date | string) =>
  fmt(d, { day: "2-digit", month: "2-digit", year: "numeric" });
/** 14:30 */
export const formatTime = (d: Date | string) => fmt(d, { hour: "2-digit", minute: "2-digit" });
/** qui., 25 de set. */
export const formatDayShort = (d: Date | string) =>
  fmt(d, { weekday: "short", day: "numeric", month: "short" });
/** quinta-feira, 25 de setembro */
export const formatDayLong = (d: Date | string) =>
  fmt(d, { weekday: "long", day: "numeric", month: "long" });
/** setembro de 2026 */
export const formatMonth = (d: Date | string) => fmt(d, { month: "long", year: "numeric" });
export const formatWeekday = (d: Date | string) => fmt(d, { weekday: "short" }).replace(".", "");

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}h${String(rest).padStart(2, "0")}` : `${h}h`;
}

/** Tempo decorrido em mm:ss ou h:mm:ss, usado na fila. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

export const statusLabel: Record<AppointmentStatus, string> = {
  agendado: "Agendado",
  confirmado: "Confirmado",
  aguardando: "Aguardando",
  em_atendimento: "Em atendimento",
  concluido: "Concluído",
  faltou: "Faltou",
  cancelado: "Cancelado",
};

export const channelLabel: Record<BookingChannel, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  site: "Site",
  presencial: "Presencial",
  telefone: "Telefone",
};

export const blockKindLabel: Record<TimeBlockKind, string> = {
  almoco: "Almoço",
  folga: "Folga",
  feriado: "Feriado",
  outro: "Bloqueado",
};

export const paymentMethodLabel: Record<PaymentMethod, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
};

export function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}
