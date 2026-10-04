import { SiteHeader, SiteFooter } from "@/components/SiteChrome";
import { EmergencyGuide } from "@/components/experience/EmergencyGuide";
import { getLocale } from "@/lib/locale";
import { getMessages, translator } from "@/lib/i18n";

export async function generateMetadata() {
  const tr = translator(getMessages(await getLocale()));
  return { title: `Rastro — ${tr("experience.emergency")}`, description: tr("experience.emergencyBody") };
}
export default async function EmergencyPage() {
  const locale = await getLocale(); const messages = getMessages(locale);
  return <><SiteHeader locale={locale} messages={messages}/><main className="ex-page"><EmergencyGuide messages={messages}/></main><SiteFooter messages={messages}/></>;
}
