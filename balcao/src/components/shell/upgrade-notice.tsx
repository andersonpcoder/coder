"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { featureLabel, featurePlan, hasFeature, PLANS, type Feature } from "@/lib/plans";
import { useStore } from "@/lib/store";

/** Mostra o conteúdo só se o plano inclui o recurso; senão, convida ao upgrade. */
export function FeatureGate({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { state } = useStore();
  if (hasFeature(state.subscription, feature)) return <>{children}</>;
  return (
    <Card className="mx-auto mt-10 max-w-lg p-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent-soft text-accent">
        <Lock className="size-5" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-semibold">{featureLabel[feature]}</h1>
      <p className="mt-2 text-sm text-muted">
        Este recurso faz parte do plano {PLANS[featurePlan[feature]].name}. Faça upgrade para liberar.
      </p>
      <Button asChild className="mt-5">
        <Link href="/configuracoes?aba=plano">Ver planos</Link>
      </Button>
    </Card>
  );
}
