import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Retorno do login com Google, da confirmação de e-mail e da recuperação de senha. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("proximo"));
  const supabase = await createClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Link inválido") };

  if (error) {
    return NextResponse.redirect(`${origin}/entrar?erro=${encodeURIComponent("O link expirou ou já foi usado. Tente de novo.")}`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}

/** Aceita só caminhos internos, para o link não virar redirecionamento aberto. */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/painel";
}
