"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell, FormError } from "@/components/auth/auth-shell";
import { roleLabel } from "@/components/shell/nav";
import { Button } from "@/components/ui/button";
import { createClient, errorMessage, isSupabaseConfigured } from "@/lib/supabase/client";
import type { Role } from "@/lib/types";

interface InviteInfo {
  company: string;
  role: Role;
  accepted: boolean;
}

export default function ConvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<InviteInfo | null | undefined>(undefined);
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setInfo(null);
      return;
    }
    const sb = createClient();
    sb.rpc("public_invite", { p_token: token }).then(({ data }) => setInfo((data as InviteInfo) ?? null));
    sb.auth.getUser().then(({ data }) => setLoggedIn(!!data.user));
  }, [token]);

  const accept = async () => {
    setLoading(true);
    const sb = createClient();
    const { data, error } = await sb.rpc("accept_invite", { p_token: token });
    setLoading(false);
    if (error) return setError(errorMessage(error));
    try {
      localStorage.setItem("balcao:empresa", data as string);
    } catch {
      // Sem preferência salva; o painel abre a primeira empresa.
    }
    router.replace("/painel");
  };

  if (info === undefined) return <AuthShell title="Carregando convite…">{null}</AuthShell>;
  if (!info || info.accepted) {
    return (
      <AuthShell title="Convite indisponível" description="Este convite não existe ou já foi usado. Peça um novo ao administrador.">
        <Button asChild><Link href="/entrar">Ir para o login</Link></Button>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={`Entrar na equipe de ${info.company}`} description={`Você foi convidado como ${roleLabel[info.role]}.`}>
      <div className="flex flex-col gap-3">
        <FormError message={error} />
        {loggedIn ? (
          <Button onClick={accept} disabled={loading}>{loading ? "Entrando…" : "Aceitar convite"}</Button>
        ) : (
          <>
            <Button asChild><Link href={`/cadastrar?convite=${token}`}>Criar minha conta</Link></Button>
            <Button asChild variant="outline"><Link href={`/entrar?proximo=/convite/${token}`}>Já tenho conta</Link></Button>
          </>
        )}
      </div>
    </AuthShell>
  );
}
