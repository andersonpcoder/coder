"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EmpresaTab } from "@/components/config/empresa-tab";
import { IntegracoesTab } from "@/components/config/integracoes-tab";
import { MensagensTab } from "@/components/config/mensagens-tab";
import { PlanoTab } from "@/components/config/plano-tab";
import { UnidadesTab } from "@/components/config/unidades-tab";
import { UsuariosTab } from "@/components/config/usuarios-tab";
import { PageHeader } from "@/components/shell/page-header";
import { useLookups } from "@/lib/store";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "empresa", label: "Empresa", Component: EmpresaTab },
  { key: "unidades", label: "Unidades", Component: UnidadesTab },
  { key: "usuarios", label: "Usuários e permissões", Component: UsuariosTab },
  { key: "mensagens", label: "Mensagens", Component: MensagensTab },
  { key: "integracoes", label: "Integrações e API", Component: IntegracoesTab },
  { key: "plano", label: "Plano e cobrança", Component: PlanoTab },
] as const;

export default function ConfiguracoesPage() {
  return (
    <Suspense>
      <Configuracoes />
    </Suspense>
  );
}

function Configuracoes() {
  const params = useSearchParams();
  const router = useRouter();
  const { currentUser } = useLookups();
  const active = TABS.find((t) => t.key === params.get("aba")) ?? TABS[0];

  if (currentUser.role !== "admin") {
    return <p className="py-20 text-center text-muted">Só o administrador acessa as configurações.</p>;
  }
  return (
    <div>
      <PageHeader title="Configurações" />
      <nav aria-label="Seções" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-current={t.key === active.key ? "page" : undefined}
              onClick={() => router.replace(`/configuracoes?aba=${t.key}`, { scroll: false })}
              className={cn(
                "min-h-11 shrink-0 border-b-2 px-3 text-sm font-semibold whitespace-nowrap",
                t.key === active.key ? "border-primary text-text" : "border-transparent text-muted hover:text-text",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      <active.Component />
    </div>
  );
}
