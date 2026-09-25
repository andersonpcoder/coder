import { NextPhase } from "@/components/shell/next-phase";
import { PageHeader } from "@/components/shell/page-header";

export default function ConfiguracoesPage() {
  return (
    <div>
      <PageHeader title="Configurações" description="Empresa, unidades, usuários, mensagens, integrações e plano." />
      <NextPhase
        items={[
          "Dados da empresa (logo, cor, endereço, horário, fuso) e unidades",
          "Usuários e permissões",
          "Modelos de mensagens (lembretes 24h/2h, aniversário, retorno)",
          "Integrações: WhatsApp Cloud API, Z-API ou Evolution API; Instagram",
          "Plano e cobrança (Stripe, Asaas ou Mercado Pago)",
        ]}
      />
    </div>
  );
}
