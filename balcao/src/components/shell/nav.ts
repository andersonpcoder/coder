import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  ListOrdered,
  MessagesSquare,
  Scissors,
  Settings,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Feature } from "@/lib/plans";
import type { Role } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  counter?: "conversas" | "fila";
  /** Recurso do plano necessário; sem ele o item aparece com cadeado. */
  feature?: Feature;
}

const all: Role[] = ["admin", "recepcao", "profissional"];
const staff: Role[] = ["admin", "recepcao"];

export const navItems: NavItem[] = [
  { href: "/painel", label: "Painel", icon: LayoutDashboard, roles: all },
  { href: "/agenda", label: "Agenda", icon: CalendarDays, roles: all },
  { href: "/fila", label: "Fila", icon: ListOrdered, roles: staff, counter: "fila", feature: "fila" },
  { href: "/atendimentos", label: "Atendimentos", icon: MessagesSquare, roles: staff, counter: "conversas", feature: "atendimentos" },
  { href: "/clientes", label: "Clientes", icon: UsersRound, roles: all },
  { href: "/equipe", label: "Equipe", icon: Users, roles: staff },
  { href: "/servicos", label: "Serviços", icon: Scissors, roles: staff },
  { href: "/financeiro", label: "Financeiro", icon: Wallet, roles: staff },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, roles: ["admin"], feature: "relatorios" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, roles: ["admin"] },
];

export const roleLabel: Record<Role, string> = {
  admin: "Administrador",
  recepcao: "Recepção",
  profissional: "Profissional",
};
