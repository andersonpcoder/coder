import { NextPhase } from "@/components/shell/next-phase";
import { PageHeader } from "@/components/shell/page-header";

export default function RelatoriosPage() {
  return (
    <div>
      <PageHeader title="Relatórios" description="Indicadores do negócio por período." />
      <NextPhase
        items={[
          "Atendimentos por período, por profissional e por serviço",
          "Taxa de faltas, horários de pico, clientes novos x recorrentes",
          "Exportar em PDF e CSV",
        ]}
      />
    </div>
  );
}
