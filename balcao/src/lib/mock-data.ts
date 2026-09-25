import { addDays, addMinutes, atMinutes, minutesOfDay, startOfDay } from "./dates";
import type {
  Appointment,
  AppointmentStatus,
  BookingChannel,
  Company,
  Conversation,
  Customer,
  Notification,
  Payment,
  PaymentMethod,
  Professional,
  QueueEntry,
  Service,
  TimeBlock,
  User,
  WorkHours,
} from "./types";

// Dados de exemplo gerados em torno da data atual, para a demonstração
// funcionar em qualquer dia. O gerador é determinístico (mesma semente).

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const h = (hours: number, minutes = 0) => hours * 60 + minutes;

function weekdays(days: number[], start: number, end: number): WorkHours {
  const wh: WorkHours = {};
  for (const d of days) wh[d] = [{ start, end }];
  return wh;
}

export const company: Company = {
  id: "c-aurora",
  name: "Estúdio Aurora",
  slug: "estudio-aurora",
  primaryColor: "#0F6E63",
  timezone: "America/Sao_Paulo",
  address: "Rua das Palmeiras, 240, Pinheiros, São Paulo, SP",
  phone: "11987654321",
};

export const services: Service[] = [
  { id: "s-corte-f", name: "Corte feminino", category: "Cabelo", durationMin: 60, priceCents: 12000, color: "lavanda" },
  { id: "s-corte-m", name: "Corte masculino", category: "Barbearia", durationMin: 30, priceCents: 5500, color: "ceu" },
  { id: "s-barba", name: "Barba", category: "Barbearia", durationMin: 30, priceCents: 4000, color: "areia" },
  { id: "s-coloracao", name: "Coloração", category: "Cabelo", durationMin: 120, priceCents: 28000, color: "rosa" },
  { id: "s-escova", name: "Escova", category: "Cabelo", durationMin: 45, priceCents: 7000, color: "pessego" },
  { id: "s-manicure", name: "Manicure", category: "Unhas", durationMin: 45, priceCents: 4500, color: "menta" },
  { id: "s-pedicure", name: "Pedicure", category: "Unhas", durationMin: 60, priceCents: 5500, color: "menta" },
  { id: "s-sobrancelha", name: "Design de sobrancelha", category: "Estética", durationMin: 30, priceCents: 5000, color: "pessego" },
];

const tueToSat = [2, 3, 4, 5, 6];
const monToFri = [1, 2, 3, 4, 5];
const monToSat = [1, 2, 3, 4, 5, 6];

export const professionals: Professional[] = [
  {
    id: "p-marina", name: "Marina Costa", title: "Cabeleireira", initials: "MC", avatarHue: 170,
    commissionPct: 40, serviceIds: ["s-corte-f", "s-escova", "s-coloracao"],
    workHours: weekdays(tueToSat, h(9), h(19)),
  },
  {
    id: "p-rafael", name: "Rafael Lima", title: "Barbeiro", initials: "RL", avatarHue: 210,
    commissionPct: 45, serviceIds: ["s-corte-m", "s-barba"],
    workHours: weekdays(monToSat, h(9), h(18)),
  },
  {
    id: "p-juliana", name: "Juliana Alves", title: "Manicure", initials: "JA", avatarHue: 330,
    commissionPct: 50, serviceIds: ["s-manicure", "s-pedicure", "s-sobrancelha"],
    workHours: weekdays(monToFri, h(8), h(17)),
  },
  {
    id: "p-bruno", name: "Bruno Tavares", title: "Barbeiro", initials: "BT", avatarHue: 30,
    commissionPct: 45, serviceIds: ["s-corte-m", "s-barba", "s-sobrancelha"],
    workHours: weekdays(tueToSat, h(10), h(20)),
  },
  {
    id: "p-camila", name: "Camila Rocha", title: "Colorista", initials: "CR", avatarHue: 270,
    commissionPct: 40, serviceIds: ["s-coloracao", "s-escova", "s-corte-f"],
    workHours: weekdays(monToSat, h(9), h(18)),
  },
];

export const users: User[] = [
  { id: "u-ana", name: "Ana Paula Mendes", role: "admin" },
  { id: "u-leticia", name: "Letícia Prado", role: "recepcao" },
  { id: "u-marina", name: "Marina Costa", role: "profissional", professionalId: "p-marina" },
];

const customerSeed: [string, string, string[], string?][] = [
  ["Beatriz Santos", "11991234567", ["VIP"], "Prefere horários pela manhã."],
  ["Carlos Eduardo Nunes", "11992345678", ["Mensalista"]],
  ["Fernanda Oliveira", "11993456789", [], "Alergia a amônia. Usar coloração sem amônia."],
  ["Gabriel Martins", "11994567890", ["Novo"]],
  ["Helena Ribeiro", "11995678901", ["VIP", "Aniversariante"]],
  ["Igor Fernandes", "11996789012", []],
  ["Larissa Gomes", "11997890123", ["Indicação"]],
  ["Lucas Pereira", "11998901234", ["Mensalista"]],
  ["Mariana Duarte", "11999012345", []],
  ["Mateus Carvalho", "11990123456", ["Faltoso"]],
  ["Patrícia Moura", "11981234567", []],
  ["Pedro Henrique Dias", "11982345678", ["Novo"]],
  ["Rafaela Teixeira", "11983456789", ["VIP"]],
  ["Renato Barbosa", "11984567890", []],
  ["Sofia Almeida", "11985678901", ["Indicação"]],
  ["Thiago Moreira", "11986789012", []],
  ["Vanessa Cardoso", "11987890123", ["Mensalista"]],
  ["Vinícius Rocha", "11988901234", []],
];

function buildCustomers(today: Date): Customer[] {
  return customerSeed.map(([name, phone, tags, notes], i) => ({
    id: `cl-${i + 1}`,
    name,
    phone,
    email: `${name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}@email.com`,
    birthDate: `19${80 + (i % 20)}-${String((i % 12) + 1).padStart(2, "0")}-${String((i * 3) % 28 + 1).padStart(2, "0")}`,
    notes,
    tags,
    createdAt: addDays(today, -(200 - i * 9)).toISOString(),
  }));
}

export interface Dataset {
  company: Company;
  users: User[];
  professionals: Professional[];
  services: Service[];
  customers: Customer[];
  appointments: Appointment[];
  blocks: TimeBlock[];
  queue: QueueEntry[];
  conversations: Conversation[];
  payments: Payment[];
  notifications: Notification[];
}

export function buildDataset(now = new Date()): Dataset {
  const random = rng(20260925);
  const today = startOfDay(now);
  const customers = buildCustomers(today);
  const appointments: Appointment[] = [];
  const blocks: TimeBlock[] = [];
  const payments: Payment[] = [];
  const channels: BookingChannel[] = ["whatsapp", "whatsapp", "whatsapp", "instagram", "site", "site", "presencial", "telefone"];
  const methods: PaymentMethod[] = ["pix", "pix", "pix", "cartao_credito", "cartao_debito", "dinheiro"];
  const nowMin = minutesOfDay(now);
  let seq = 0;

  for (let offset = -28; offset <= 28; offset++) {
    const day = addDays(today, offset);
    for (const pro of professionals) {
      const windows = pro.workHours[day.getDay()];
      if (!windows) continue;
      const lunchStart = h(12) + (pro.id.length % 2) * 60;
      blocks.push({
        id: `b-${pro.id}-${offset}`,
        professionalId: pro.id,
        kind: "almoco",
        reason: "Almoço",
        start: atMinutes(day, lunchStart).toISOString(),
        end: atMinutes(day, lunchStart + 60).toISOString(),
      });
      for (const w of windows) {
        let cursor = w.start;
        while (cursor < w.end) {
          if (cursor >= lunchStart && cursor < lunchStart + 60) {
            cursor = lunchStart + 60;
            continue;
          }
          const serviceId = pro.serviceIds[Math.floor(random() * pro.serviceIds.length)];
          const service = services.find((s) => s.id === serviceId)!;
          const fits = cursor + service.durationMin <= w.end &&
            !(cursor < lunchStart + 60 && cursor + service.durationMin > lunchStart);
          const occupancy = offset < 0 ? 0.72 : offset === 0 ? 0.8 : Math.max(0.2, 0.7 - offset * 0.035);
          if (fits && random() < occupancy) {
            const start = atMinutes(day, cursor);
            const end = addMinutes(start, service.durationMin);
            const customer = customers[Math.floor(random() * customers.length)];
            const status = pickStatus(offset, cursor, cursor + service.durationMin, nowMin, random);
            const id = `a-${++seq}`;
            appointments.push({
              id,
              professionalId: pro.id,
              serviceId: service.id,
              customerId: customer.id,
              start: start.toISOString(),
              end: end.toISOString(),
              status,
              channel: channels[Math.floor(random() * channels.length)],
              priceCents: service.priceCents,
            });
            if (status === "concluido") {
              payments.push({
                id: `pg-${seq}`,
                appointmentId: id,
                customerId: customer.id,
                professionalId: pro.id,
                method: methods[Math.floor(random() * methods.length)],
                amountCents: service.priceCents,
                paidAt: end.toISOString(),
              });
            }
            cursor += service.durationMin;
          } else {
            cursor += 30;
          }
        }
      }
    }
  }

  // Um feriado e uma folga nas próximas semanas.
  const holiday = addDays(today, 12);
  blocks.push({
    id: "b-feriado",
    kind: "feriado",
    reason: "Feriado municipal",
    start: atMinutes(holiday, 0).toISOString(),
    end: atMinutes(holiday, 24 * 60 - 1).toISOString(),
  });
  const dayOff = addDays(today, 5);
  blocks.push({
    id: "b-folga",
    professionalId: "p-camila",
    kind: "folga",
    reason: "Curso de especialização",
    start: atMinutes(dayOff, 0).toISOString(),
    end: atMinutes(dayOff, 24 * 60 - 1).toISOString(),
  });
  const cleanAppointments = appointments.filter((a) => {
    const start = new Date(a.start);
    return !(
      startOfDay(start).getTime() === holiday.getTime() ||
      (a.professionalId === "p-camila" && startOfDay(start).getTime() === dayOff.getTime())
    );
  });

  const queue = buildQueue(now, cleanAppointments, customers);
  return {
    company,
    users,
    professionals,
    services,
    customers,
    appointments: cleanAppointments,
    blocks,
    queue,
    conversations: buildConversations(now),
    payments,
    notifications: [
      { id: "n-1", title: "Novo agendamento pelo site", body: "Sofia Almeida agendou Manicure para amanhã às 10:00", at: addMinutes(now, -12).toISOString(), read: false, link: "/agenda" },
      { id: "n-2", title: "Nova mensagem no WhatsApp", body: "Beatriz Santos: Consigo remarcar para sábado?", at: addMinutes(now, -25).toISOString(), read: false, link: "/atendimentos" },
      { id: "n-3", title: "Agendamento cancelado", body: "Igor Fernandes cancelou Corte masculino de sexta", at: addMinutes(now, -95).toISOString(), read: true, link: "/agenda" },
    ],
  };
}

function pickStatus(
  offset: number,
  start: number,
  end: number,
  nowMin: number,
  random: () => number,
): AppointmentStatus {
  const r = random();
  const past = offset < 0 || (offset === 0 && end <= nowMin);
  if (past) return r < 0.84 ? "concluido" : r < 0.93 ? "faltou" : "cancelado";
  if (offset === 0 && start <= nowMin) return "em_atendimento";
  if (offset === 0 && start - nowMin <= 40) return r < 0.5 ? "aguardando" : "confirmado";
  if (r < 0.05) return "cancelado";
  return offset <= 1 && r < 0.6 ? "confirmado" : r < 0.3 ? "confirmado" : "agendado";
}

function buildQueue(now: Date, appointments: Appointment[], customers: Customer[]): QueueEntry[] {
  const nameOf = (id: string) => customers.find((c) => c.id === id)?.name ?? "Cliente";
  const today = startOfDay(now);
  const todays = appointments
    .filter((a) => startOfDay(new Date(a.start)).getTime() === today.getTime())
    .sort((a, b) => a.start.localeCompare(b.start));
  const entries: QueueEntry[] = [];
  let scheduled = 0;
  for (const a of todays) {
    if (!["aguardando", "em_atendimento", "concluido"].includes(a.status)) continue;
    const start = new Date(a.start);
    const checkedIn = addMinutes(start, -(8 + (scheduled % 3) * 4));
    scheduled++;
    entries.push({
      id: `q-${a.id}`,
      ticket: `A${String(scheduled).padStart(3, "0")}`,
      customerName: nameOf(a.customerId),
      customerId: a.customerId,
      appointmentId: a.id,
      serviceId: a.serviceId,
      professionalId: a.professionalId,
      isWalkIn: false,
      status: a.status === "aguardando" ? "aguardando" : a.status === "em_atendimento" ? "em_atendimento" : "concluido",
      checkedInAt: (checkedIn > now ? addMinutes(now, -6) : checkedIn).toISOString(),
      calledAt: a.status === "aguardando" ? undefined : start.toISOString(),
      startedAt: a.status === "aguardando" ? undefined : start.toISOString(),
      finishedAt: a.status === "concluido" ? a.end : undefined,
    });
  }
  entries.push(
    {
      id: "q-e1", ticket: "E001", customerName: "Rogério Batista", isWalkIn: true, status: "aguardando",
      serviceId: "s-corte-m", checkedInAt: addMinutes(now, -14).toISOString(),
    },
    {
      id: "q-e2", ticket: "E002", customerName: "Aline Figueiredo", isWalkIn: true, status: "aguardando",
      serviceId: "s-manicure", professionalId: "p-juliana", checkedInAt: addMinutes(now, -4).toISOString(),
    },
  );
  return entries;
}

function msg(id: string, direction: "entrada" | "saida" | "sistema", body: string, at: Date, authorId?: string) {
  return { id, direction, body, at: at.toISOString(), authorId };
}

function buildConversations(now: Date): Conversation[] {
  const m = (min: number) => addMinutes(now, -min);
  return [
    {
      id: "cv-1", customerId: "cl-1", channel: "whatsapp", status: "aberta", assignedTo: "u-leticia",
      tags: ["Remarcação"], unread: 2,
      messages: [
        msg("m-1", "entrada", "Oi! Tudo bem? Tenho um horário marcado com vocês.", m(40)),
        msg("m-2", "saida", "Oi, Beatriz! Tudo ótimo. Isso mesmo, já estou vendo aqui. Posso ajudar em algo?", m(38), "u-leticia"),
        msg("m-3", "entrada", "Surgiu um compromisso 😕", m(26)),
        msg("m-4", "entrada", "Consigo remarcar para sábado?", m(25)),
      ],
    },
    {
      id: "cv-2", customerId: "cl-4", channel: "instagram", status: "aberta", tags: ["Novo cliente"], unread: 1,
      messages: [
        msg("m-5", "entrada", "Olá, quanto custa corte + barba?", m(18)),
      ],
    },
    {
      id: "cv-3", customerId: "cl-7", channel: "site", status: "aberta", assignedTo: "u-ana", tags: [], unread: 0,
      messages: [
        msg("m-6", "sistema", "Conversa iniciada pelo chat do site", m(90)),
        msg("m-7", "entrada", "Vocês fazem coloração sem amônia?", m(90)),
        msg("m-8", "saida", "Fazemos sim, Larissa! A Camila é especialista. Quer que eu veja um horário?", m(85), "u-ana"),
        msg("m-9", "entrada", "Quero sim, de preferência de manhã", m(60)),
      ],
    },
    {
      id: "cv-4", customerId: "cl-13", channel: "whatsapp", status: "aberta", assignedTo: "u-leticia", tags: ["VIP"], unread: 0,
      messages: [
        msg("m-10", "saida", "Olá, Rafaela! Lembrete: amanhã às 14:00 você tem Coloração com Camila. Responda 1 para confirmar.", m(300)),
        msg("m-11", "entrada", "1", m(240)),
        msg("m-12", "sistema", "Agendamento confirmado pelo cliente", m(240)),
        msg("m-13", "entrada", "Posso levar uma foto de referência?", m(120)),
      ],
    },
    {
      id: "cv-5", customerId: "cl-8", channel: "whatsapp", status: "aberta", tags: ["Mensalista"], unread: 3,
      messages: [
        msg("m-14", "entrada", "Bom dia!", m(9)),
        msg("m-15", "entrada", "Tem horário hoje com o Rafael?", m(8)),
        msg("m-16", "entrada", "Pode ser no fim da tarde", m(7)),
      ],
    },
    {
      id: "cv-6", customerId: "cl-15", channel: "instagram", status: "resolvida", assignedTo: "u-ana", tags: [], unread: 0,
      messages: [
        msg("m-17", "entrada", "Amei o resultado da manicure! 💅", m(1500)),
        msg("m-18", "saida", "Que bom, Sofia! Obrigada pelo carinho. Até a próxima!", m(1490), "u-ana"),
      ],
    },
    {
      id: "cv-7", customerId: "cl-10", channel: "whatsapp", status: "resolvida", assignedTo: "u-leticia", tags: ["Faltoso"], unread: 0,
      messages: [
        msg("m-19", "saida", "Oi, Mateus. Sentimos sua falta ontem. Quer remarcar?", m(2900), "u-leticia"),
        msg("m-20", "entrada", "Desculpa, esqueci. Depois eu vejo", m(2800)),
      ],
    },
    {
      id: "cv-8", customerId: "cl-3", channel: "site", status: "aberta", tags: [], unread: 1,
      messages: [
        msg("m-21", "sistema", "Conversa iniciada pelo chat do site", m(3)),
        msg("m-22", "entrada", "Qual o endereço de vocês?", m(3)),
      ],
    },
  ];
}
