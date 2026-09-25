"use client";

import * as D from "@radix-ui/react-dialog";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Bell, Menu, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { deviceTimeZone, formatTime } from "@/lib/format";
import { trialDaysLeft } from "@/lib/plans";
import { useLookups, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Logo, SidebarNav, UserMenu } from "./sidebar";

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("balcao:tema", next ? "escuro" : "claro");
    } catch {
      // Preferência não persistida; o tema vale só para esta sessão.
    }
  };
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={dark ? "Usar modo claro" : "Usar modo escuro"}>
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

function Notifications() {
  const { state, db } = useStore();
  const unread = state.notifications.filter((n) => !n.read).length;
  return (
    <Dropdown.Root onOpenChange={(open) => !open && unread > 0 && void db.readNotifications()}>
      <Dropdown.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notificações${unread ? `, ${unread} novas` : ""}`} className="relative">
          <Bell />
          {unread > 0 && <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-accent" aria-hidden />}
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="end" sideOffset={6} className="z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-1.5 shadow-xl">
          <Dropdown.Label className="px-3 py-2 text-sm font-semibold">Notificações</Dropdown.Label>
          {state.notifications.length === 0 && <p className="px-3 pb-3 text-sm text-muted">Nada por aqui ainda.</p>}
          {state.notifications.slice(0, 15).map((n) => (
            <Dropdown.Item key={n.id} asChild>
              <Link
                href={n.link ?? "#"}
                className="flex gap-3 rounded-xl px-3 py-2.5 outline-none data-[highlighted]:bg-surface-2"
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-accent")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{n.title}</span>
                  <span className="block text-[13px] text-muted">{n.body}</span>
                  <span className="block text-xs text-muted">{formatTime(n.at)}</span>
                </span>
              </Link>
            </Dropdown.Item>
          ))}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

function UnitSwitcher() {
  const { state, dispatch } = useStore();
  if (state.units.length < 2) return <span className="hidden text-sm text-muted lg:inline">{state.company.name}</span>;
  return (
    <select
      aria-label="Unidade"
      value={state.currentUnitId ?? ""}
      onChange={(e) => dispatch({ type: "setUnit", unitId: e.target.value || undefined })}
      className="hidden min-h-11 rounded-xl border border-border bg-surface px-3 text-sm sm:block"
    >
      <option value="">Todas as unidades</option>
      {state.units.map((u) => (
        <option key={u.id} value={u.id}>{u.name}</option>
      ))}
    </select>
  );
}

function TrialBanner() {
  const { state, mode } = useStore();
  const { currentUser } = useLookups();
  const sub = state.subscription;
  if (mode === "supabase" && currentUser.role !== "admin") return null;
  if (mode === "demo") {
    return <span className="hidden rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent md:inline">Modo demonstração</span>;
  }
  if (sub.status === "teste") {
    const days = trialDaysLeft(sub);
    return (
      <Link href="/configuracoes?aba=plano" className="hidden rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent md:inline">
        {days > 0 ? `Teste grátis: ${days} dia${days === 1 ? "" : "s"}` : "Teste encerrado: escolha um plano"}
      </Link>
    );
  }
  if (sub.status === "inadimplente" || sub.status === "cancelada") {
    return (
      <Link href="/configuracoes?aba=plano" className="rounded-full bg-danger-soft px-3 py-1 text-xs font-semibold text-danger">
        {sub.status === "inadimplente" ? "Pagamento pendente" : "Assinatura cancelada"}
      </Link>
    );
  }
  return null;
}

/** Avisa quando o aparelho está num fuso diferente do da empresa. */
function TimeZoneNotice() {
  const { state } = useStore();
  const [device, setDevice] = useState("");
  useEffect(() => setDevice(deviceTimeZone()), []);
  if (!device || device === state.company.timezone) return null;
  return (
    <p role="status" className="border-b border-warning/30 bg-warning-soft px-4 py-2 text-center text-xs text-text sm:px-6">
      Este aparelho está no fuso {device.replace("_", " ")}, e a empresa usa {state.company.timezone.replace("_", " ")}. Os horários aparecem no fuso do aparelho.
    </p>
  );
}

export function Topbar() {
  const [open, setOpen] = useState(false);
  return (
    <>
    <TimeZoneNotice />
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-bg/85 px-4 backdrop-blur sm:px-6">
      <D.Root open={open} onOpenChange={setOpen}>
        <D.Trigger asChild>
          <Button variant="ghost" size="icon" className="-ml-2 lg:hidden" aria-label="Abrir menu">
            <Menu />
          </Button>
        </D.Trigger>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-40 bg-black/40 lg:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-6 bg-bg px-4 py-5 shadow-2xl lg:hidden" aria-describedby={undefined}>
            <div className="flex items-center justify-between">
              <D.Title asChild>
                <span><Logo /></span>
              </D.Title>
              <D.Close className="grid size-11 place-items-center rounded-xl text-muted hover:bg-surface-2" aria-label="Fechar menu">
                <X className="size-5" />
              </D.Close>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SidebarNav onNavigate={() => setOpen(false)} />
            </div>
            <UserMenu />
          </D.Content>
        </D.Portal>
      </D.Root>
      <span className="lg:hidden"><Logo /></span>
      <UnitSwitcher />
      <div className="ml-auto flex items-center gap-2">
        <TrialBanner />
        <Notifications />
        <ThemeToggle />
      </div>
    </header>
    </>
  );
}
