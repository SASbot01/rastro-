import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { ReportWaiting } from "@/components/ReportWaiting";
import { ReportView, type ReportData, type AssistantView } from "@/components/ReportView";
import { getMessages, isLocale, translator, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { supabaseAdmin } from "@/lib/supabase";
import { REPORT_STEPS, type ReportStep } from "@/lib/report/job";
import { getSession, sessionOwns } from "@/lib/session";
import { findUserByEmail } from "@/lib/users";
import { isPro } from "@/lib/plan";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RequestRow {
  id: string;
  email: string;
  full_name: string;
  locale: string;
  status: string;
  step: string | null;
  error: string | null;
}

interface RawAi {
  perplexity?: { answers?: Array<{ key: string; answer: string; sources: Array<{ title: string; url: string }> }> };
  assistants?: { answers?: Array<{ provider: "openai" | "gemini"; answer: string; sources: Array<{ title: string; url: string }> }>; failed?: Array<{ provider: "openai" | "gemini" }>; skipped?: Array<"openai" | "gemini"> };
}

/** Respuestas literales de cada asistente para la seccion "Lo que responde cada IA". */
function assistantsFrom(raw: RawAi | null | undefined): AssistantView[] {
  const out: AssistantView[] = [];
  const who = raw?.perplexity?.answers?.find((a) => a.key === "who");
  if (who) out.push({ provider: "perplexity", answer: who.answer, sources: who.sources ?? [], status: "ok" });
  for (const a of raw?.assistants?.answers ?? []) out.push({ provider: a.provider, answer: a.answer, sources: a.sources ?? [], status: "ok" });
  for (const f of raw?.assistants?.failed ?? []) out.push({ provider: f.provider, answer: "", sources: [], status: "failed" });
  for (const p of raw?.assistants?.skipped ?? []) out.push({ provider: p, answer: "", sources: [], status: "skipped" });
  return out;
}

async function loadRequest(id: string, ownerEmail: string): Promise<{ request: RequestRow; report: ReportData | null } | null> {
  if (!UUID.test(id)) return null;
  const supabase = supabaseAdmin();

  const { data: request } = await supabase
    .from("requests")
    .select("id, email, full_name, locale, status, step, error")
    .eq("id", id)
    .eq("email", ownerEmail)
    .maybeSingle<RequestRow>();
  if (!request) return null;

  let report: ReportData | null = null;
  if (request.status === "done") {
    const { data } = await supabase
      .from("reports")
      .select("score, summary, findings, actions, created_at, generator, accounts, raw")
      .eq("request_id", id)
      .maybeSingle<ReportData & { raw: RawAi | null }>();
    if (data) {
      const { raw, ...rest } = data;
      report = { ...rest, assistants: assistantsFrom(raw) };
    }
  }
  return { request, report };
}

function Panel({ title, body, cta, href }: { title: string; body: string; cta: string; href: string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(26,26,25,0.04)] sm:p-8">
      <span aria-hidden="true" className="mb-5 block h-1.5 w-10 rounded-full bg-line" />
      <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">{title}</h1>
      <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{body}</p>
      <Link
        href={href}
        className="mt-6 inline-block rounded-[10px] bg-accent px-5 py-3 text-[15px] font-semibold text-black transition-opacity hover:opacity-90"
      >
        {cta}
      </Link>
    </div>
  );
}

export async function generateMetadata({ params }: PageProps<"/informe/[id]">): Promise<Metadata> {
  const { id } = await params;
  const locale = await getLocale();
  const tr = translator(getMessages(locale));
  return {
    title: `Rastro — ${tr("report.eyebrow")}`,
    // El informe es personal: nunca indexado. La imagen OG solo lleva score y nombre tapado.
    robots: { index: false, follow: false },
    openGraph: UUID.test(id)
      ? { title: `Rastro — ${tr("report.eyebrow")}`, images: [{ url: `/informe/${id}/imagen`, width: 1200, height: 630 }] }
      : undefined,
  };
}

export default async function ReportPage({ params, searchParams }: PageProps<"/informe/[id]">) {
  const { id } = await params;
  const { reveal } = await searchParams;
  const session = await getSession();
  const loaded = session ? await loadRequest(id, session.email) : null;

  // El informe se muestra en el idioma con el que se pidio, no el del navegador.
  const locale: Locale =
    loaded && isLocale(loaded.request.locale) ? loaded.request.locale : await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);

  let body: React.ReactNode;

  // Privado: solo la sesion del correo que pidio el informe. El enlace del
  // correo crea esa sesion; desde otro dispositivo se entra por /entrar.
  if (!session) {
    body = <Panel title={tr("account.mustLoginTitle")} body={tr("account.mustLoginBody")} cta={tr("account.mustLoginCta")} href="/entrar" />;
  } else if (!loaded) {
    body = (
      <Panel
        title={tr("waiting.notFoundTitle")}
        body={tr("waiting.notFoundBody")}
        cta={tr("verify.retry")}
        href="/#form"
      />
    );
  } else if (!sessionOwns(session, loaded.request.email)) {
    body = (
      <Panel
        title={tr("account.mustLoginTitle")}
        body={tr("account.mustLoginBody")}
        cta={tr("account.mustLoginCta")}
        href="/entrar"
      />
    );
  } else if (loaded.request.status === "done" && loaded.report) {
    body = (
      <ReportView
        report={loaded.report}
        requestId={loaded.request.id}
        fullName={loaded.request.full_name}
        locale={locale}
        messages={messages}
        partial={loaded.report.generator !== "ai"}
        pro={isPro(session ? await findUserByEmail(session.email) : null)}
        reveal={reveal === "1"}
      />
    );
  } else if (loaded.request.status === "error" || loaded.request.status === "done") {
    // 'done' sin fila en reports no deberia pasar; se trata como error.
    body = (
      <Panel
        title={tr("waiting.errorTitle")}
        body={tr("waiting.errorBody")}
        cta={tr("verify.retry")}
        href="/#form"
      />
    );
  } else {
    const step = loaded.request.step;
    body = (
      <ReportWaiting
        id={loaded.request.id}
        steps={REPORT_STEPS}
        initialStep={(REPORT_STEPS as readonly string[]).includes(step ?? "") ? (step as ReportStep) : null}
        messages={messages}
      />
    );
  }

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />
      <main className="mx-auto w-full max-w-[640px] lg:max-w-[920px] px-5 py-10 sm:py-14">{body}</main>
      <SiteFooter messages={messages} />
    </>
  );
}
