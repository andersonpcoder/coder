"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { ChevronsUpDown, RotateCcw } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { useLookups, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { navItems, roleLabel } from "./nav";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-fg" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M4 10h16M6 10v9M18 10v9M3 19h18M8 6h8" />
        </svg>
      </span>
      <span className="font-display text-xl font-bold tracking-tight">Balcão</span>
    </span>
  );
}

export function useNavCounters() {
  const { state } = useStore();
  return {
    conversas: state.conversations.filter((c) => c.status === "aberta" && c.unread > 0).length,
    fila: state.queue.filter((q) => q.status === "aguardando").length,
  };
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { currentUser } = useLookups();
  const counters = useNavCounters();
  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-0.5">
      {navItems
        .filter((item) => item.roles.includes(currentUser.role))
        .map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const count = item.counter ? counters[item.counter] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors",
                active ? "bg-surface text-text shadow-sm dark:bg-surface-2" : "text-muted hover:bg-surface/70 hover:text-text",
              )}
            >
              <item.icon className={cn("size-[18px]", active && "text-primary")} aria-hidden />
              <span className="flex-1">{item.label}</span>
              {count > 0 && (
                <span
                  className="min-w-6 rounded-full bg-accent px-1.5 text-center text-xs font-semibold leading-6 text-white"
                  aria-label={`${count} pendentes`}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
    </nav>
  );
}

export function UserMenu() {
  const { state, dispatch, reset, toast } = useStore();
  const { currentUser } = useLookups();
  return (
    <Dropdown.Root>
      <Dropdown.Trigger className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 text-left hover:bg-surface/70">
        <Avatar name={currentUser.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{currentUser.name}</span>
          <span className="block text-xs text-muted">{roleLabel[currentUser.role]}</span>
        </span>
        <ChevronsUpDown className="size-4 text-muted" aria-hidden />
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-50 w-64 rounded-2xl border border-border bg-surface p-1.5 text-sm shadow-xl"
        >
          <Dropdown.Label className="px-3 py-2 text-xs font-semibold text-muted">
            Ver como (demonstração de permissões)
          </Dropdown.Label>
          {state.users.map((u) => (
            <Dropdown.Item
              key={u.id}
              onSelect={() => {
                dispatch({ type: "setUser", userId: u.id });
                toast(`Agora você vê o Balcão como ${roleLabel[u.role]}.`);
              }}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 outline-none data-[highlighted]:bg-surface-2",
                u.id === currentUser.id && "font-semibold",
              )}
            >
              <Avatar name={u.name} size="sm" />
              <span className="flex-1">{u.name}</span>
              <span className="text-xs text-muted">{roleLabel[u.role]}</span>
            </Dropdown.Item>
          ))}
          <Dropdown.Separator className="my-1 h-px bg-border" />
          <Dropdown.Item
            onSelect={() => {
              reset();
              toast("Dados de exemplo restaurados.", "sucesso");
            }}
            className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-muted outline-none data-[highlighted]:bg-surface-2"
          >
            <RotateCcw className="size-4" /> Restaurar dados de exemplo
          </Dropdown.Item>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-border px-4 py-5 lg:flex">
      <Link href="/painel" className="px-2" aria-label="Balcão, ir para o painel">
        <Logo />
      </Link>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav />
      </div>
      <UserMenu />
    </aside>
  );
}
