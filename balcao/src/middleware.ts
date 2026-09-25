import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rotas do painel: exigem login quando o Supabase está configurado.
const PROTECTED = [
  "/painel", "/agenda", "/fila", "/atendimentos", "/clientes", "/equipe", "/servicos",
  "/financeiro", "/relatorios", "/configuracoes", "/tv", "/onboarding", "/nova-senha",
];
const AUTH_PAGES = ["/entrar", "/cadastrar"];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Sem Supabase, ou com o cookie de demonstração, tudo roda no navegador.
  if (!url || !key || request.cookies.get("balcao-demo")?.value === "1") return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  // Renova a sessão (e os cookies) a cada navegação.
  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  if (!data.user && PROTECTED.some((p) => path === p || path.startsWith(`${p}/`))) {
    const target = request.nextUrl.clone();
    target.pathname = "/entrar";
    target.search = `?proximo=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(target);
  }
  if (data.user && AUTH_PAGES.includes(path) && !request.nextUrl.searchParams.get("convite")) {
    const next = request.nextUrl.searchParams.get("proximo");
    const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/painel";
    return NextResponse.redirect(new URL(safe, request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|favicon.ico|api/).*)"],
};
