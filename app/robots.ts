import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rastropro.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/informe/", "/cartas/", "/cuenta", "/herramientas", "/api/", "/verify", "/entrar", "/demo"] }],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
