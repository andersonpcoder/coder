"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AuthShell, FormError } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createClient, errorMessage } from "@/lib/supabase/client";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?proximo=/nova-senha`,
    });
    setLoading(false);
    if (error) setError(errorMessage(error));
    else setSent(true);
  };

  return (
    <AuthShell
      title="Recuperar senha"
      description="Enviaremos um link para você criar uma nova senha."
      footer={<Link href="/entrar" className="font-semibold text-primary">Voltar para o login</Link>}
    >
      {sent ? (
        <div className="flex items-start gap-3 rounded-xl bg-primary-soft p-4 text-sm" role="status">
          <MailCheck className="size-5 shrink-0 text-primary" aria-hidden />
          Se existir uma conta com {email}, você receberá o link em instantes. Confira também o spam.
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="E-mail">
            {(id) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <FormError message={error} />
          <Button type="submit" disabled={loading}>{loading ? "Enviando…" : "Enviar link"}</Button>
        </form>
      )}
    </AuthShell>
  );
}
