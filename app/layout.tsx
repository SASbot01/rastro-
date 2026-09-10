import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { getLocale } from "@/lib/locale";
import { getMessages, translator } from "@/lib/i18n";
import { BottomNav } from "@/components/BottomNav";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const tr = translator(getMessages(locale));
  return {
    title: `Rastro — ${tr("hero.title")}`,
    description: tr("hero.subtitle"),
    openGraph: {
      title: `Rastro — ${tr("hero.title")}`,
      description: tr("hero.subtitle"),
      locale,
      type: "website",
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  // Analitica sin cookies (Plausible). Solo se carga si hay dominio configurado.
  const plausible = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  return (
    <html lang={locale} className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col pb-[76px] sm:pb-0">
        {children}
        <BottomNav messages={getMessages(locale)} />
        {plausible && <Script defer data-domain={plausible} src="https://plausible.io/js/script.js" strategy="afterInteractive" />}
      </body>
    </html>
  );
}
