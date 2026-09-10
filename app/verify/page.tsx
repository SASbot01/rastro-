import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, isLocale, translator, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { supabaseAdmin } from "@/lib/supabase";
import { hashToken } from "@/lib/crypto";
import { runReportJob } from "@/lib/report/job";

export const dynamic = "force-dynamic";
/** El job del informe corre en `after()` dentro de esta ruta: 90 s es el tope de CLAUDE.md. */
export const maxDuration = 90;

type Outcome =
  | { kind: "ok"; id: string; startJob: boolean; locale?: Locale }
  | { kind: "expired" | "invalid"; locale?: Locale };

/**
 * Consume el token del enlace: marca la solicitud como verificada, anula el
 * token (un solo uso) y la reclama para el job ('processing'). Si ya estaba
 * verificada, solo devuelve el id para volver al informe.
 */
async function consumeToken(token: string | undefined): Promise<Outcome> {
  if (!token) return { kind: "invalid" };

  const supabase = supabaseAdmin();
  const { data: row, error } = await supabase
    .from("requests")
    .select("id, locale, status, verified_at, verify_expires_at")
    .eq("verify_token", hashToken(token))
    .maybeSingle();

  if (error) {
    console.error("[/verify] consulta fallo:", error);
    return { kind: "invalid" };
  }
  if (!row) return { kind: "invalid" };

  const locale = isLocale(row.locale) ? row.locale : undefined;

  if (row.verified_at) return { kind: "ok", id: row.id, startJob: false, locale };

  if (row.verify_expires_at && new Date(row.verify_expires_at) < new Date()) {
    return { kind: "expired", locale };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("requests")
    .update({
      verified_at: now,
      status: "processing",
      started_at: now,
      verify_token: null,
      verify_expires_at: null,
    })
    .eq("id", row.id)
    .eq("status", "pending"); // reclamacion atomica: solo un verify arranca el job

  if (updateError) {
    console.error("[/verify] actualizacion fallo:", updateError);
    return { kind: "invalid", locale };
  }

  return { kind: "ok", id: row.id, startJob: true, locale };
}

export default async function VerifyPage({ searchParams }: PageProps<"/verify">) {
  const { token } = await searchParams;
  const outcome = await consumeToken(typeof token === "string" ? token : undefined);

  if (outcome.kind === "ok") {
    if (outcome.startJob) {
      const id = outcome.id;
      after(() => runReportJob(id));
    }
    redirect(`/informe/${outcome.id}`);
  }

  const locale = outcome.locale ?? (await getLocale());
  const messages = getMessages(locale);
  const tr = translator(messages);

  const copy =
    outcome.kind === "expired"
      ? { title: tr("verify.expiredTitle"), body: tr("verify.expiredBody") }
      : { title: tr("verify.invalidTitle"), body: tr("verify.invalidBody") };

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />

      <main className="mx-auto w-full max-w-[640px] px-5 py-16">
        <div className="rounded-card border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(26,26,25,0.04)] sm:p-8">
          <span aria-hidden="true" className="mb-5 block h-1.5 w-10 rounded-full bg-line" />
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">{copy.title}</h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{copy.body}</p>
          <Link
            href="/#form"
            className="mt-6 inline-block rounded-[10px] bg-accent px-5 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            {tr("verify.retry")}
          </Link>
        </div>
      </main>

      <SiteFooter messages={messages} />
    </>
  );
}
