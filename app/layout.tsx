import { RefCapture } from "@/components/RefCapture";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { getLocale } from "@/lib/locale";
import { getMessages, translator } from "@/lib/i18n";
import { BottomNav, SideNav } from "@/components/BottomNav";
import { AskRastro } from "@/components/AskRastro";
import "./globals.css";
import "./experience.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const tr = translator(getMessages(locale));
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    title: `Rastro — ${tr("hero.title")}`,
    description: tr("hero.subtitle"),
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [{ url: "/brand/icon-32.png", sizes: "32x32" }, { url: "/brand/icon-192.png", sizes: "192x192" }],
      apple: [{ url: "/brand/icon-180.png", sizes: "180x180" }],
    },
    openGraph: {
      title: `Rastro — ${tr("hero.title")}`,
      description: tr("hero.subtitle"),
      locale,
      type: "website",
      images: [{ url: "/brand/og.png", width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", images: ["/brand/og.png"] },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const messages = getMessages(locale);
  // Analitica sin cookies (Plausible). Solo se carga si hay dominio configurado.
  const plausible = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  // Cloudflare Web Analytics (gratis, sin cookies): token del panel de Cloudflare.
  const cfToken = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;
  return (
    <html lang={locale} data-theme="dark" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full pb-[calc(64px+env(safe-area-inset-bottom))] sm:pb-0">
        <a className="ex-skip" href="#page-content">{messages.experience.skipContent}</a>
        <div className="mx-auto flex min-h-screen w-full max-w-[1200px]">
          <SideNav messages={getMessages(locale)} />
          <div id="page-content" tabIndex={-1} className="flex min-h-screen min-w-0 flex-1 flex-col"><RefCapture />
        {children}</div>
        </div>
        <BottomNav messages={getMessages(locale)} />
        <AskRastro messages={getMessages(locale)} locale={locale} />
        {plausible && <Script defer data-domain={plausible} src="https://plausible.io/js/script.js" strategy="afterInteractive" />}
        {cfToken && <Script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon={`{"token": "${cfToken}"}`} strategy="afterInteractive" />}
      </body>
    </html>
  );
}
