import type { MetadataRoute } from "next";
import { getLocale } from "@/lib/locale";
import { getMessages } from "@/lib/i18n";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const messages = getMessages(await getLocale());
  return {
    name: "Rastro",
    short_name: "Rastro",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    shortcuts: [
      { name: messages.guardian.title, url: "/guardian" },
      { name: messages.experience.demoReport, url: "/informe" },
      { name: messages.experience.emergency, url: "/ayuda-urgente" },
    ],
    icons: [
      { src: "/brand/mascot-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
