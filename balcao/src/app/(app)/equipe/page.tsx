"use client";

import { NextPhase } from "@/components/shell/next-phase";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useLookups, useStore } from "@/lib/store";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export default function EquipePage() {
  const { state } = useStore();
  const { services } = useLookups();
  return (
    <div>
      <PageHeader title="Equipe" description={`${state.professionals.length} profissionais`} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {state.professionals.map((p) => {
          const days = Object.keys(p.workHours).map(Number).sort();
          const w = p.workHours[days[0]]?.[0];
          return (
            <Card key={p.id} className="p-5">
              <div className="flex items-center gap-3">
                <Avatar name={p.name} hue={p.avatarHue} size="lg" />
                <div>
                  <h2 className="font-display text-lg font-semibold">{p.name}</h2>
                  <p className="text-sm text-muted">{p.title} · comissão {p.commissionPct}%</p>
                </div>
              </div>
              <p className="mt-4 text-sm"><span className="text-muted">Horário:</span> {days.map((d) => DAYS[d]).join(", ")}{w && ` · ${hhmm(w.start)} às ${hhmm(w.end)}`}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.serviceIds.map((id) => <Badge key={id}>{services.get(id)?.name}</Badge>)}
              </div>
            </Card>
          );
        })}
      </div>
      <NextPhase items={["Cadastrar e editar profissionais", "Horários de trabalho por dia com intervalos", "Convite de acesso para o profissional"]} />
    </div>
  );
}
