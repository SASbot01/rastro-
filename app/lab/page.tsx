import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { LabWorkspace } from "@/components/LabWorkspace";
import { LabMcpGuide } from "@/components/LabMcpGuide";
import { getMessages, isLocale, translator } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { getSession } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { canUseLab, loadWorkspace } from "@/lib/lab";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const tr = translator(getMessages(await getLocale()));
  return { title: `Rastro — ${tr("lab.title")}`, description: tr("lab.subtitle"), robots: { index: false } };
}

/** Rastro Lab: cuaderno de laboratorios y bug bounty. Solo cuentas Pro y administradores. */
export default async function LabPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);
  const session = await getSession();
  if (!session) redirect("/entrar?next=/lab");
  const user = await findUserByEmail(session.email);
  if (!user) redirect("/entrar?next=/lab");

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="page py-8 sm:py-12">
        <p className="eyebrow">{tr("lab.eyebrow")}</p>
        <h1 className="mt-2 h1 text-ink">{tr("lab.title")}</h1>
        <p className="lead mt-2 max-w-[62ch]">{tr("lab.subtitle")}</p>
        {canUseLab(user) ? (
          <div className="mt-6">
            <LabMcpGuide messages={messages} />
            <LabContent userId={user.id} locale={isLocale(user.locale) ? user.locale : "es"} messages={messages} pageLocale={locale} />
          </div>
        ) : (
          <div className="card card-pad card-accent mt-6">
            <p className="text-[16px] font-semibold text-ink">{tr("lab.locked")}</p>
            <Link href="/pro" className="btn btn-primary mt-4">{tr("lab.lockedCta")}</Link>
          </div>
        )}
      </main>
      <SiteFooter messages={messages} />
    </>
  );
}

async function LabContent({ userId, locale, messages, pageLocale }: { userId: string; locale: "es" | "en"; messages: ReturnType<typeof getMessages>; pageLocale: "es" | "en" }) {
  const { workspace, updatedAt } = await loadWorkspace(userId, locale);
  return <LabWorkspace initial={workspace} initialUpdatedAt={updatedAt} messages={messages} locale={pageLocale} />;
}
