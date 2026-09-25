"use client";

import { CreditCard, QrCode } from "lucide-react";
import { CycleToggle, PlanHighlights, PriceTag } from "@/components/shared/pricing";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { addDays } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { effectivePlan, GRACE_DAYS, isActive, PLANS, trialDaysLeft, type BillingCycle } from "@/lib/plans";
import { useStore } from "@/lib/store";
import { errorMessage } from "@/lib/supabase/client";
import type { PlanTier } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusLabel = { teste: "Teste grátis", ativa: "Ativa", inadimplente: "Pagamento pendente", cancelada: "Cancelada" } as const;

export function PlanoTab() {
  const { state, dispatch, supabase, refresh, toast } = useStore();
  const sub = state.subscription;
  const [method, setMethod] = useState<"pix" | "cartao">("pix");
  const [document, setDocument] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>(sub.billingCycle ?? "mensal");
  const [busy, setBusy] = useState<PlanTier | "cancelar" | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const current = effectivePlan(sub);
  const activePros = state.professionals.filter((p) => p.active).length;

  const subscribe = async (plan: PlanTier) => {
    const limit = PLANS[plan].maxProfessionals;
    if (limit !== null && activePros > limit) {
      return toast(`O plano ${PLANS[plan].name} permite ${limit} profissional(is). Desative profissionais em Equipe antes de mudar.`, "erro");
    }
    setBusy(plan);
    if (!supabase) {
      dispatch({
        type: "setSubscription",
        subscription: { ...sub, plan, status: "ativa", billingCycle: cycle, currentPeriodEnd: addDays(new Date(), cycle === "anual" ? 365 : 30).toISOString(), provider: "demonstracao" },
      });
      toast(`Plano ${PLANS[plan].name} ativado (demonstração, sem cobrança).`, "sucesso");
      setBusy(null);
      return;
    }
    const { data, error } = await supabase.functions.invoke("billing-checkout", {
      body: { company_id: state.company.id, plan, cycle, method, document: document.replace(/\D/g, "") || undefined, return_url: `${window.location.origin}/configuracoes?aba=plano` },
    });
    setBusy(null);
    if (error || !data?.url) return toast(`Não foi possível abrir o pagamento: ${errorMessage(error ?? data?.error)}`, "erro");
    window.location.href = data.url;
  };

  const cancel = async () => {
    setBusy("cancelar");
    if (supabase) {
      const { error } = await supabase.functions.invoke("billing-cancel", { body: { company_id: state.company.id } });
      if (error) {
        setBusy(null);
        return toast(errorMessage(error), "erro");
      }
      await refresh();
    } else {
      dispatch({ type: "setSubscription", subscription: { ...sub, status: "cancelada" } });
    }
    setBusy(null);
    setCancelling(false);
    toast("Assinatura cancelada. O acesso segue até o fim do período pago.", "sucesso");
  };

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader><CardTitle>Sua assinatura</CardTitle><Badge tone={sub.status === "ativa" ? "success" : sub.status === "teste" ? "accent" : "danger"}>{statusLabel[sub.status]}</Badge></CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div><p className="text-muted">Plano em uso</p><p className="font-display text-xl font-semibold">{PLANS[current].name}{sub.status === "ativa" && sub.billingCycle === "anual" ? " (anual)" : ""}</p></div>
          <div>
            <p className="text-muted">{sub.status === "teste" ? "Teste termina em" : "Próxima cobrança"}</p>
            <p className="font-display text-xl font-semibold">
              {sub.status === "teste" ? `${formatDate(sub.trialEndsAt)} (${trialDaysLeft(sub)} dias)` : sub.currentPeriodEnd ? formatDate(sub.currentPeriodEnd) : "Não definida"}
            </p>
          </div>
          <div><p className="text-muted">Profissionais ativos</p><p className="font-display text-xl font-semibold">{activePros}{PLANS[current].maxProfessionals !== null && ` de ${PLANS[current].maxProfessionals}`}</p></div>
          {sub.status === "teste" && <p className="text-muted sm:col-span-3">No teste grátis todos os recursos do plano Empresa estão liberados. Escolha um plano para continuar depois do teste.</p>}
          {sub.status === "inadimplente" && (
            <p className="text-danger sm:col-span-3">
              Não conseguimos cobrar a última mensalidade. A agenda continua liberada por {GRACE_DAYS} dias; depois fica bloqueada até o pagamento.
            </p>
          )}
          {!isActive(sub) && <p className="font-semibold text-danger sm:col-span-3">A conta está bloqueada. Escolha um plano abaixo para reabrir a agenda.</p>}
        </CardContent>
      </Card>

      <CycleToggle value={cycle} onChange={setCycle} />
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="mb-2 text-sm font-semibold">Forma de pagamento</legend>
        {([["pix", "Pix", QrCode], ["cartao", "Cartão de crédito", CreditCard]] as const).map(([v, l, Icon]) => (
          <label key={v} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-medium", method === v ? "border-primary bg-primary-soft text-primary" : "border-border")}>
            <input type="radio" name="metodo" className="sr-only" checked={method === v} onChange={() => setMethod(v)} />
            <Icon className="size-4" /> {l}
          </label>
        ))}
      </fieldset>
      <Field label="CPF ou CNPJ para a nota fiscal" className="max-w-xs">
        {(id) => <Input id={id} inputMode="numeric" value={document} onChange={(e) => setDocument(e.target.value)} />}
      </Field>

      <div className="grid gap-4 lg:grid-cols-3">
        {Object.values(PLANS).map((p) => {
          const isCurrent = sub.status === "ativa" && sub.plan === p.tier && (sub.billingCycle ?? "mensal") === cycle;
          return (
            <Card key={p.tier} className={cn("flex flex-col p-6", isCurrent && "border-primary ring-1 ring-primary")}>
              <h3 className="text-xl font-semibold">{p.name}</h3>
              <PriceTag plan={p} cycle={cycle} />
              <PlanHighlights plan={p} />
              <Button className="mt-6" variant={isCurrent ? "outline" : "primary"} disabled={isCurrent || busy !== null} onClick={() => subscribe(p.tier)}>
                {isCurrent ? "Plano atual" : busy === p.tier ? "Abrindo pagamento…" : sub.status === "ativa" ? "Mudar para este plano" : "Assinar"}
              </Button>
            </Card>
          );
        })}
      </div>

      {sub.status === "ativa" && (
        <Button variant="ghost" className="self-start text-danger" onClick={() => setCancelling(true)}>Cancelar assinatura</Button>
      )}
      <ConfirmDialog open={cancelling} title="Cancelar a assinatura?" confirmLabel="Cancelar assinatura" danger busy={busy === "cancelar"} onConfirm={cancel} onClose={() => setCancelling(false)}>
        <p className="text-sm text-muted">Você continua com acesso até o fim do período já pago. Depois, a conta volta para os recursos do plano Básico.</p>
      </ConfirmDialog>
    </div>
  );
}
