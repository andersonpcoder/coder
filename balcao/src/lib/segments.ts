import type { ServiceColor } from "./types";

export interface SegmentTemplate {
  value: string;
  label: string;
  professionalTitle: string;
  services: { name: string; category: string; durationMin: number; priceCents: number; color: ServiceColor }[];
}

/** Serviços sugeridos no onboarding, por tipo de negócio. Tudo é editável depois. */
export const SEGMENTS: SegmentTemplate[] = [
  {
    value: "barbearia",
    label: "Barbearia",
    professionalTitle: "Barbeiro",
    services: [
      { name: "Corte masculino", category: "Cabelo", durationMin: 30, priceCents: 5000, color: "ceu" },
      { name: "Barba", category: "Barba", durationMin: 30, priceCents: 4000, color: "areia" },
      { name: "Corte + barba", category: "Combo", durationMin: 60, priceCents: 8000, color: "lavanda" },
    ],
  },
  {
    value: "salao",
    label: "Salão de beleza",
    professionalTitle: "Cabeleireira",
    services: [
      { name: "Corte feminino", category: "Cabelo", durationMin: 60, priceCents: 12000, color: "lavanda" },
      { name: "Escova", category: "Cabelo", durationMin: 45, priceCents: 7000, color: "pessego" },
      { name: "Coloração", category: "Cabelo", durationMin: 120, priceCents: 25000, color: "rosa" },
      { name: "Manicure", category: "Unhas", durationMin: 45, priceCents: 4500, color: "menta" },
    ],
  },
  {
    value: "clinica",
    label: "Clínica",
    professionalTitle: "Médico(a)",
    services: [
      { name: "Consulta", category: "Consultas", durationMin: 30, priceCents: 25000, color: "ceu" },
      { name: "Retorno", category: "Consultas", durationMin: 20, priceCents: 0, color: "menta" },
      { name: "Procedimento", category: "Procedimentos", durationMin: 60, priceCents: 40000, color: "lavanda" },
    ],
  },
  {
    value: "odonto",
    label: "Consultório odontológico",
    professionalTitle: "Dentista",
    services: [
      { name: "Avaliação", category: "Consultas", durationMin: 30, priceCents: 15000, color: "ceu" },
      { name: "Limpeza", category: "Prevenção", durationMin: 45, priceCents: 20000, color: "menta" },
      { name: "Restauração", category: "Tratamento", durationMin: 60, priceCents: 30000, color: "pessego" },
      { name: "Manutenção de aparelho", category: "Ortodontia", durationMin: 30, priceCents: 18000, color: "lavanda" },
    ],
  },
  {
    value: "estudio",
    label: "Estúdio (estética, tatuagem, pilates)",
    professionalTitle: "Profissional",
    services: [
      { name: "Sessão", category: "Sessões", durationMin: 60, priceCents: 15000, color: "lavanda" },
      { name: "Avaliação", category: "Sessões", durationMin: 30, priceCents: 0, color: "menta" },
    ],
  },
  {
    value: "servicos",
    label: "Outro prestador de serviço",
    professionalTitle: "Profissional",
    services: [{ name: "Atendimento", category: "Geral", durationMin: 60, priceCents: 10000, color: "ceu" }],
  },
];

export const TIMEZONES = [
  { value: "America/Sao_Paulo", label: "Brasília (GMT-3)" },
  { value: "America/Manaus", label: "Manaus (GMT-4)" },
  { value: "America/Cuiaba", label: "Cuiabá (GMT-4)" },
  { value: "America/Porto_Velho", label: "Porto Velho (GMT-4)" },
  { value: "America/Rio_Branco", label: "Rio Branco (GMT-5)" },
  { value: "America/Noronha", label: "Fernando de Noronha (GMT-2)" },
];

export const BRAND_COLORS = ["#0F6E63", "#1D4E89", "#7A3E9D", "#B4372F", "#C8742B", "#2F6B2F", "#1C2321"];

export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
