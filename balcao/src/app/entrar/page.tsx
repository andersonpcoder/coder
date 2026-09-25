"use client";

import { PlayCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell, FormError, GoogleIcon } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createClient, errorMessage, isSupabaseConfigured, setDemoCookie } from "@/lib/supabase/client";

export default function EntrarPage() {
  return (
    <Suspense>
      <Entrar />
    </Suspense>
  );
}

function Entrar() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("proximo") ?? "/painel";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.get("erro") ?? "");
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message.includes("Invalid login") ? "E-mail ou senha incorretos." : errorMessage(error));
      return;
    }
    setDemoCookie(false);
    router.replace(next);
    router.refresh();
  };

  const google = async () => {
    setError("");
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?proximo=${encodeURIComponent(next)}` },
    });
    if (error) setError(errorMessage(error));
  };

  const demo = () => {
    setDemoCookie(true);
    router.push("/painel");
  };

  return (
    <AuthShell
      title="Entrar"
      description="Acesse a agenda, a fila e os atendimentos do seu negócio."
      footer={
        configured && (
          <>
            Ainda não tem conta? <Link href={`/cadastrar${params.get("convite") ? `?convite=${params.get("convite")}` : ""}`} className="font-semibold text-primary">Comece o teste grátis de 14 dias</Link>
          </>
        )
      }
    >
      {configured ? (
        <div className="flex flex-col gap-4">
          <Button variant="outline" onClick={google}>
            <GoogleIcon /> Continuar com Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
            <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="E-mail">
              {(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
            </Field>
            <Field label="Senha">
              {(id) => <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
            </Field>
            <FormError message={error} />
            <Button type="submit" disabled={loading}>{loading ? "Entrando…" : "Entrar"}</Button>
            <Link href="/recuperar-senha" className="text-center text-sm font-semibold text-primary">Esqueci minha senha</Link>
          </form>
          <Button variant="ghost" onClick={demo}>
            <PlayCircle /> Ver demonstração com dados de exemplo
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm">
            O login é ativado ao configurar o Supabase (veja o README). Enquanto isso, use a demonstração.
          </p>
          <Button onClick={demo}>
            <PlayCircle /> Entrar na demonstração
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
