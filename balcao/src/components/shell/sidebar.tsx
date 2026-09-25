"use client";

import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Building2, ChevronsUpDown, Lock, LogOut, RotateCcw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { hasFeature } from "@/lib/plans";
import { useLookups, useStore } from "@/lib/store";
import { isSupabaseConfigured, setDemoCookie } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { navItems, roleLabel } from "./nav";

export { Logo };

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
  const { state } = useStore();
  const counters = useNavCounters();
  return (
    <nav aria-label="Menu principal" className="flex flex-col gap-0.5">
      {navItems
        .filter((item) => item.roles.includes(currentUser.role))
        .map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const locked = item.feature ? !hasFeature(state.subscription, item.feature) : false;
          const count = item.counter && !locked ? counters[item.counter] : 0;
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
              {locked && <Lock className="size-3.5 text-muted" aria-label="Disponível em outro plano" />}
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

const itemClass =
  "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 outline-none data-[highlighted]:bg-surface-2";

export function UserMenu() {
  const { state, dispatch, reset, toast, mode, supabase, memberships, switchCompany } = useStore();
  const { currentUser } = useLookups();
  const router = useRouter();

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    setDemoCookie(false);
    router.replace("/entrar");
  };

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
          className="z-50 w-72 rounded-2xl border border-border bg-surface p-1.5 text-sm shadow-xl"
        >
          {mode === "demo" ? (
            <>
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
                  className={cn(itemClass, u.id === currentUser.id && "font-semibold")}
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
                className={cn(itemClass, "text-muted")}
              >
                <RotateCcw className="size-4" /> Restaurar dados de exemplo
              </Dropdown.Item>
              {isSupabaseConfigured() && (
                <Dropdown.Item onSelect={signOut} className={cn(itemClass, "text-muted")}>
                  <LogOut className="size-4" /> Sair da demonstração
                </Dropdown.Item>
              )}
            </>
          ) : (
            <>
              {memberships.length > 1 && (
                <>
                  <Dropdown.Label className="px-3 py-2 text-xs font-semibold text-muted">Empresas</Dropdown.Label>
                  {memberships.map((m) => (
                    <Dropdown.Item
                      key={m.companyId}
                      onSelect={() => m.companyId !== state.company.id && switchCompany(m.companyId)}
                      className={cn(itemClass, m.companyId === state.company.id && "font-semibold")}
                    >
                      <Building2 className="size-4" /> <span className="flex-1 truncate">{m.companyName}</span>
                    </Dropdown.Item>
                  ))}
                  <Dropdown.Separator className="my-1 h-px bg-border" />
                </>
              )}
              <Dropdown.Item onSelect={() => router.push("/onboarding?nova=1")} className={cn(itemClass, "text-muted")}>
                <Building2 className="size-4" /> Cadastrar outra empresa
              </Dropdown.Item>
              <Dropdown.Item onSelect={signOut} className={cn(itemClass, "text-muted")}>
                <LogOut className="size-4" /> Sair
              </Dropdown.Item>
            </>
          )}
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
