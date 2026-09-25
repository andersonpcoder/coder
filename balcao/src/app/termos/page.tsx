import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/shell/logo";

export const metadata: Metadata = { title: "Termos de uso e privacidade" };

// Modelo de termos. Revise com um advogado antes de publicar.
export default function TermosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/" aria-label="Página inicial"><Logo /></Link>
      <article className="mt-8 flex flex-col gap-4 text-[15px] leading-relaxed [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold">
        <h1 className="text-3xl font-semibold">Termos de uso e política de privacidade</h1>
        <p className="text-sm text-muted">Versão 2026-09. Modelo a ser revisado pelo responsável jurídico da empresa que opera o Balcão.</p>

        <h2>1. Quem somos e papéis na LGPD</h2>
        <p>
          O Balcão é um sistema de agendamento e atendimento. A empresa que contrata o Balcão (clínica, salão,
          barbearia etc.) é a <strong>controladora</strong> dos dados dos seus clientes. O Balcão atua como
          <strong> operador</strong>, tratando os dados apenas para prestar o serviço contratado.
        </p>

        <h2>2. Dados tratados</h2>
        <p>
          Nome, telefone/WhatsApp, e-mail, data de nascimento, histórico de agendamentos, pagamentos, conversas e
          observações registradas pela empresa. Dos usuários do painel: nome, e-mail e registros de acesso.
        </p>

        <h2>3. Finalidades e bases legais</h2>
        <ul className="list-disc pl-6">
          <li>Agendar, lembrar e prestar o atendimento (execução de contrato, art. 7º, V).</li>
          <li>Enviar lembretes, mensagens de aniversário e de retorno (consentimento, art. 7º, I, que pode ser revogado).</li>
          <li>Emitir cobranças e cumprir obrigações fiscais (obrigação legal, art. 7º, II).</li>
        </ul>

        <h2>4. Consentimento no agendamento online</h2>
        <p>
          Ao agendar pela página pública, o cliente aceita estes termos. A data do aceite fica registrada. O cliente pode
          pedir a revogação a qualquer momento pelo contato da empresa.
        </p>

        <h2>5. Direitos do titular</h2>
        <p>
          O titular pode pedir confirmação, acesso, correção, portabilidade e eliminação dos dados. A empresa atende o
          pedido pelo painel (Clientes &gt; Exportar dados e Excluir dados). Registros de pagamento são mantidos sem
          vínculo com a pessoa pelo prazo exigido pela legislação fiscal.
        </p>

        <h2>6. Compartilhamento</h2>
        <p>
          Os dados são processados por fornecedores necessários ao serviço: hospedagem (Supabase e Vercel), envio de
          mensagens (Meta WhatsApp Business ou provedor escolhido pela empresa), e-mail transacional e pagamentos
          (Stripe, Asaas ou Mercado Pago). Não vendemos dados.
        </p>

        <h2>7. Segurança</h2>
        <p>
          Cada empresa só acessa os próprios dados (isolamento por linha no banco), com permissões por papel
          (administrador, recepção e profissional). Conexões são criptografadas.
        </p>

        <h2>8. Contato do encarregado (DPO)</h2>
        <p>privacidade@balcao.app</p>
      </article>
    </div>
  );
}
