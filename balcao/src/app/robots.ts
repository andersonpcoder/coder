import type { MetadataRoute } from "next";

// O painel é privado; só a página inicial, os termos e as páginas públicas das empresas são indexados.
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://balcao.app";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/painel", "/agenda", "/fila", "/atendimentos", "/clientes", "/equipe", "/servicos", "/financeiro",
        "/relatorios", "/configuracoes", "/tv", "/onboarding", "/agendamento/", "/convite/", "/auth/", "/nova-senha",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
