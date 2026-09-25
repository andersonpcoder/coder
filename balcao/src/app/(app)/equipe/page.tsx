"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { ProfessionalDialog } from "@/components/equipe/professional-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PLANS, effectivePlan } from "@/lib/plans";
import { useLookups, useStore } from "@/lib/store";
import type { Professional } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export default function EquipePage() {
  const { state } = useStore();
  const { services, currentUser } = useLookups();
  const [editing, setEditing] = useState<Professional | null | undefined>(undefined);
  const isAdmin = currentUser.role === "admin";
  const plan = PLANS[effectivePlan(state.subscription)];
  const activeCount = state.professionals.filter((p) => p.active).length;
  const list = [...state.professionals].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "pt-BR"));

  return (
    <div>
      <PageHeader
        title="Equipe"
        description={`${activeCount} profissionais ativos${plan.maxProfessionals !== null ? ` de ${plan.maxProfessionals} no plano ${plan.name}` : ""}`}
        actions={isAdmin && <Button onClick={() => setEditing(null)}><Plus /> Novo profissional</Button>}
      />
      {list.length === 0 && <p className="rounded-2xl bg-surface-2 p-10 text-center text-muted">Nenhum profissional cadastrado.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => {
          const days = Object.keys(p.workHours).map(Number).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
          return (
            <Card key={p.id} className={cn("flex flex-col p-5", !p.active && "opacity-60")}>
              <div className="flex items-center gap-3">
                <Avatar name={p.name} hue={p.avatarHue} size="lg" />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-display text-lg font-semibold">{p.name}</h2>
                  <p className="text-sm text-muted">{p.title || "Profissional"} · comissão {p.commissionPct}%</p>
                </div>
                {!p.active && <Badge>Inativo</Badge>}
                {p.userId && <Badge tone="primary">Com acesso</Badge>}
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                {days.length === 0 && <li className="text-muted">Sem horário definido</li>}
                {days.map((d) => (
                  <li key={d} className="flex justify-between"><span className="text-muted">{DAYS[d]}</span><span className="tabular-nums">{p.workHours[d].map((w) => `${hhmm(w.start)}-${hhmm(w.end)}`).join(", ")}</span></li>
                ))}
              </ul>
              <div className="mt-3 flex flex-1 flex-wrap content-start gap-1.5">
                {p.serviceIds.map((id) => services.get(id)).filter(Boolean).map((s) => <Badge key={s!.id}>{s!.name}</Badge>)}
              </div>
              <Button variant="outline" className="mt-4 self-start" onClick={() => setEditing(p)}>
                <Pencil /> {isAdmin ? "Editar" : "Ver detalhes"}
              </Button>
            </Card>
          );
        })}
      </div>
      <ProfessionalDialog open={editing !== undefined} professional={editing ?? undefined} onClose={() => setEditing(undefined)} />
    </div>
  );
}
