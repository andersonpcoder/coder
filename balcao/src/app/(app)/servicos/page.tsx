"use client";

import { NextPhase } from "@/components/shell/next-phase";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { formatDuration, money } from "@/lib/format";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function ServicosPage() {
  const { state } = useStore();
  return (
    <div>
      <PageHeader title="Serviços" description={`${state.services.length} serviços ativos`} />
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-border">
              <th className="px-4 py-3 font-semibold">Serviço</th>
              <th className="px-4 py-3 font-semibold">Categoria</th>
              <th className="px-4 py-3 font-semibold">Duração</th>
              <th className="px-4 py-3 font-semibold">Preço</th>
              <th className="px-4 py-3 font-semibold">Profissionais</th>
            </tr>
          </thead>
          <tbody>
            {state.services.map((s) => (
              <tr key={s.id} className="border-b border-border/70 last:border-0">
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2.5 font-semibold">
                    <span className={cn("svc size-4 rounded", `svc-${s.color}`)} aria-hidden /> {s.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">{s.category}</td>
                <td className="px-4 py-3">{formatDuration(s.durationMin)}</td>
                <td className="px-4 py-3 tabular-nums">{money(s.priceCents)}</td>
                <td className="px-4 py-3 text-muted">
                  {state.professionals.filter((p) => p.serviceIds.includes(s.id)).map((p) => p.name.split(" ")[0]).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <NextPhase items={["Cadastrar e editar serviços, cor na agenda e profissionais habilitados"]} />
    </div>
  );
}
