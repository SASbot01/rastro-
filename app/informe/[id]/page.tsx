import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { ReportWaiting } from "@/components/ReportWaiting";
import { ReportView, type ReportData } from "@/components/ReportView";
import { getMessages, isLocale, translator, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { supabaseAdmin } from "@/lib/supabase";
import { REPORT_STEPS, type ReportStep } from "@/lib/report/job";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RequestRow {
  id: string;
  full_name: string;
  locale: string;
  status: string;
  step: string | null;
  error: string | null;
}

async function loadRequest(id: string): Promise<{ request: RequestRow; report: ReportData | null } | null> {
  if (!UUID.test(id)) return null;
  const supabase = supabaseAdmin();

  const { data: request } = await supabase
    .from("requests")
    .select("id, full_name, locale, status, step, error")
    .eq("id", id)
    .maybeSingle<RequestRow>();
  if (!request) return null;

  let report: ReportData | null = null;
  if (request.status === "done") {
    const { data } = await supabase
      .from("reports")
      .select("score, summary, findings, actions, created_at, generator")
      .eq("request_id", id)
      .maybeSingle<ReportData>();
    report = data;
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
        className="mt-6 inline-block rounded-[10px] bg-accent px-5 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        {cta}
      </Link>
    </div>
  );
}

export default async function ReportPage({ params }: PageProps<"/informe/[id]">) {
  const { id } = await params;
  const loaded = await loadRequest(id);

  // El informe se muestra en el idioma con el que se pidio, no el del navegador.
  const locale: Locale =
    loaded && isLocale(loaded.request.locale) ? loaded.request.locale : await getLocale();
  const messages = getMessages(locale);
  const tr = translator(messages);

  let body: React.ReactNode;

  if (!loaded) {
    body = (
      <Panel
        title={tr("waiting.notFoundTitle")}
        body={tr("waiting.notFoundBody")}
        cta={tr("verify.retry")}
        href="/#form"
      />
    );
  } else if (loaded.request.status === "done" && loaded.report) {
    body = (
      <ReportView
        report={loaded.report}
        fullName={loaded.request.full_name}
        locale={locale}
        messages={messages}
        partial={loaded.report.generator !== "ai"}
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
      <main className="mx-auto w-full max-w-[640px] px-5 py-10 sm:py-14">{body}</main>
      <SiteFooter messages={messages} />
    </>
  );
}
