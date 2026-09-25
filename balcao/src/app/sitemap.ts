import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://balcao.app";
  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/cadastrar`, changeFrequency: "yearly", priority: 0.8 },
    { url: `${base}/termos`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
