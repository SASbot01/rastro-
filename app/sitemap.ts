import type { MetadataRoute } from "next";
import { BROKERS } from "@/lib/brokers/catalog";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://rastropro.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/pro`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/sitios`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/como-funciona`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/guardian`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/equipos`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    ...BROKERS.map((b) => ({ url: `${BASE}/sitios/${b.slug}`, lastModified: new Date(b.checked), changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${BASE}/privacidad`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/aviso-legal`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
