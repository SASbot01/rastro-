import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { getLocale } from "@/lib/locale";
import { getMessages, translator } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#faf9f7",
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
  return (
    <html lang={locale} className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
