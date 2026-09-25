"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell, FormError, GoogleIcon } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createClient, errorMessage, setDemoCookie } from "@/lib/supabase/client";

export default function CadastrarPage() {
  return (
    <Suspense>
      <Cadastrar />
    </Suspense>
  );
}

function Cadastrar() {
  const router = useRouter();
  const params = useSearchParams();
  const invite = params.get("convite");
  const next = invite ? `/convite/${invite}` : "/onboarding";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    setLoading(true);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?proximo=${encodeURIComponent(next)}`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message.includes("already registered") ? "Este e-mail já tem conta. Entre ou recupere a senha." : errorMessage(error));
      return;
    }
    setDemoCookie(false);
    // Com confirmação de e-mail desligada a sessão já vem pronta.
    if (data.session) {
      router.replace(next);
      router.refresh();
    } else {
      setSent(true);
    }
  };

  const google = async () => {
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?proximo=${encodeURIComponent(next)}` },
    });
    if (error) setError(errorMessage(error));
  };

  if (sent) {
    return (
      <AuthShell title="Confira seu e-mail" description={`Enviamos um link de confirmação para ${email}.`}>
        <div className="flex items-start gap-3 rounded-xl bg-primary-soft p-4 text-sm">
          <MailCheck className="size-5 shrink-0 text-primary" aria-hidden />
          Abra o link para ativar a conta e continuar o cadastro da sua empresa.
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={invite ? "Crie sua conta para entrar na equipe" : "Comece seu teste grátis"}
      description={invite ? undefined : "14 dias com todos os recursos. Sem cartão de crédito."}
      footer={<>Já tem conta? <Link href={`/entrar${invite ? `?proximo=/convite/${invite}` : ""}`} className="font-semibold text-primary">Entrar</Link></>}
    >
      <div className="flex flex-col gap-4">
        <Button variant="outline" onClick={google}>
          <GoogleIcon /> Continuar com Google
        </Button>
        <div className="flex items-center gap-3 text-xs text-muted" aria-hidden>
          <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Seu nome">
            {(id) => <Input id={id} autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="E-mail">
            {(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Senha" hint="Mínimo de 8 caracteres.">
            {(id) => <Input id={id} type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" required className="mt-0.5 size-5 accent-[var(--primary)]" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
            <span>
              Li e aceito os <Link href="/termos" className="font-semibold text-primary">Termos de uso e a Política de privacidade</Link>, conforme a LGPD.
            </span>
          </label>
          <FormError message={error} />
          <Button type="submit" disabled={loading || !accepted}>{loading ? "Criando conta…" : "Criar conta"}</Button>
        </form>
      </div>
    </AuthShell>
  );
}
