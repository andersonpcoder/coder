"use client";

import * as D from "@radix-ui/react-dialog";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { Bell, Menu, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/format";
import { useStore } from "@/lib/store";
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
  const { state, dispatch } = useStore();
  const unread = state.notifications.filter((n) => !n.read).length;
  return (
    <Dropdown.Root onOpenChange={(open) => !open && unread && dispatch({ type: "readNotifications" })}>
      <Dropdown.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notificações${unread ? `, ${unread} novas` : ""}`} className="relative">
          <Bell />
          {unread > 0 && <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-accent" aria-hidden />}
        </Button>
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align="end" sideOffset={6} className="z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-1.5 shadow-xl">
          <Dropdown.Label className="px-3 py-2 text-sm font-semibold">Notificações</Dropdown.Label>
          {state.notifications.map((n) => (
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

export function Topbar() {
  const [open, setOpen] = useState(false);
  const { state } = useStore();
  return (
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
      <span className="hidden text-sm text-muted lg:inline">{state.company.name}</span>
      <div className="ml-auto flex items-center gap-1">
        <Notifications />
        <ThemeToggle />
      </div>
    </header>
  );
}
