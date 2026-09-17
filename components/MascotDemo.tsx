"use client";

import { useEffect } from "react";
import { analyzeCookies, summarize } from "@/extensions/guardian/lib/analyze.js";
import type { Locale } from "@/lib/i18n";

interface MascotApi { setReport: (r: unknown, lines: string[]) => void; open: () => void; destroy: () => void; say: (lines: string[]) => void }
declare global { interface Window { RastroMascot?: { create: (opts: Record<string, unknown>) => MascotApi } } }

const NOW = Math.floor(Date.now() / 1000);
const d = (days: number) => NOW + days * 86400;
/** Web de ejemplo: lo que encuentra la extension en una tienda corriente. */
const SAMPLE = [
  { name: "PHPSESSID", domain: "tienda-de-ejemplo.es", session: true, secure: true, httpOnly: false },
  { name: "_ga", domain: ".tienda-de-ejemplo.es", expirationDate: d(730) },
  { name: "_ga_K2J9", domain: ".tienda-de-ejemplo.es", expirationDate: d(730) },
  { name: "_fbp", domain: ".tienda-de-ejemplo.es", expirationDate: d(90) },
  { name: "_ttp", domain: ".tienda-de-ejemplo.es", expirationDate: d(390) },
  { name: "cto_bundle", domain: ".tienda-de-ejemplo.es", expirationDate: d(395) },
  { name: "IDE", domain: ".doubleclick.net", expirationDate: d(390) },
  { name: "demdex", domain: ".demdex.net", expirationDate: d(180) },
  { name: "_hjSessionUser_1", domain: ".tienda-de-ejemplo.es", expirationDate: d(365) },
];

/** Robot jugable en la pagina /extension: mismo script que usa la extension. */
export function MascotDemo({ locale, labels }: { locale: Locale; labels: Record<string, unknown> }) {
  useEffect(() => {
    let api: MascotApi | null = null;
    let cancelled = false;
    const start = () => {
      if (cancelled || !window.RastroMascot) return;
      const report = analyzeCookies({ siteHost: String(labels.demoSite), cookies: SAMPLE, bannerVisible: true, thirdPartyHosts: ["connect.facebook.net", "static.criteo.net", "rlcdn.com", "analytics.tiktok.com"] });
      api = window.RastroMascot.create({
        labels: { title: "Rastro Guardián", privacy: labels.bubblePrivacy, robots: labels.robots, waiting: labels.waiting },
        actions: [
          { label: labels.reject, primary: true, run: (a: MascotApi) => a.say([String(labels.rejected)]) },
          { label: labels.more, run: () => window.open("/sitios", "_self") },
        ],
      });
      api.setReport(report, summarize(report, locale));
      (window as unknown as { __rastroDemo?: MascotApi }).__rastroDemo = api;
    };
    if (window.RastroMascot) start();
    else {
      const s = document.createElement("script");
      s.src = "/extension/mascot.js";
      s.onload = start;
      document.head.appendChild(s);
    }
    return () => { cancelled = true; api?.destroy(); };
  }, [locale, labels]);
  return null;
}
