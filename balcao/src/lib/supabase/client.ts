import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Cliente do Supabase no navegador (uma instância por aba). */
export function createClient(): SupabaseClient {
  client ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  return client;
}

/** Cookie que força o modo demonstração mesmo com o Supabase configurado. */
export const DEMO_COOKIE = "balcao-demo";

export function isDemoMode(): boolean {
  if (!isSupabaseConfigured()) return true;
  return typeof document !== "undefined" && document.cookie.split("; ").includes(`${DEMO_COOKIE}=1`);
}

export function setDemoCookie(on: boolean) {
  document.cookie = on ? `${DEMO_COOKIE}=1; path=/; max-age=2592000; samesite=lax` : `${DEMO_COOKIE}=; path=/; max-age=0`;
}

/** Mensagem legível de um erro do Supabase (as exceções do banco já vêm em português). */
export function errorMessage(error: unknown): string {
  if (!error) return "Erro desconhecido";
  if (typeof error === "object" && "message" in error) {
    const msg = String((error as { message: string }).message);
    if (msg.includes("appointments_no_overlap")) return "Conflito de horário com outro agendamento.";
    if (msg.includes("customers_company_phone_key")) return "Já existe um cliente com este telefone.";
    if (msg.includes("companies_slug_key")) return "Este endereço já está em uso. Escolha outro.";
    if (msg.includes("row-level security")) return "Você não tem permissão para esta ação.";
    return msg;
  }
  return String(error);
}
