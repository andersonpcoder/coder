"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isActive } from "@/lib/plans";
import { useLookups, useStore } from "@/lib/store";

/**
 * Sem assinatura ativa (teste acabou, pagamento atrasado há mais de 7 dias ou
 * cancelada) o painel fica bloqueado até escolher um plano. Os dados continuam
 * guardados. O banco aplica a mesma regra (has_active_plan).
 */
export function SubscriptionGate({ children }: { children: ReactNode }) {
  const { state, mode } = useStore();
  const { currentUser } = useLookups();
  const pathname = usePathname();
  if (mode === "demo" || isActive(state.subscription) || pathname.startsWith("/configuracoes")) return <>{children}</>;

  const sub = state.subscription;
  const title =
    sub.status === "teste" ? "Seu teste grátis terminou" : sub.status === "inadimplente" ? "Pagamento em atraso" : "Assinatura encerrada";
  return (
    <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
        <Lock className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted">
        Seus clientes, agenda e histórico estão guardados. Escolha um plano para voltar a usar o Balcão e reabrir o
        agendamento online.
      </p>
      {currentUser.role === "admin" ? (
        <Button asChild className="mt-5">
          <Link href="/configuracoes?aba=plano">Escolher plano</Link>
        </Button>
      ) : (
        <p className="mt-5 text-sm font-semibold">Peça ao administrador da empresa para renovar a assinatura.</p>
      )}
    </Card>
  );
}
