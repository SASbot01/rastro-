import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { getMessages, isLocale, translator, type Locale } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { supabaseAdmin } from "@/lib/supabase";
import { hashToken } from "@/lib/crypto";

export const dynamic = "force-dynamic";

type Outcome = "ok" | "expired" | "invalid";

/**
 * Consume el token del enlace: marca la solicitud como verificada y lo anula
 * para que no se pueda reutilizar. Devuelve tambien el idioma que el usuario
 * eligio al pedir el informe, para responder en ese idioma.
 */
async function consumeToken(
  token: string | undefined,
): Promise<{ outcome: Outcome; locale?: Locale }> {
  if (!token) return { outcome: "invalid" };

  const supabase = supabaseAdmin();
  const { data: row, error } = await supabase
    .from("requests")
    .select("id, locale, status, verified_at, verify_expires_at")
    .eq("verify_token", hashToken(token))
    .maybeSingle();

  if (error) {
    console.error("[/verify] consulta fallo:", error);
    return { outcome: "invalid" };
  }
  if (!row) return { outcome: "invalid" };

  const locale = isLocale(row.locale) ? row.locale : undefined;

  // Ya verificada: el enlace es valido pero no hay nada que hacer.
  if (row.verified_at) return { outcome: "ok", locale };

  if (row.verify_expires_at && new Date(row.verify_expires_at) < new Date()) {
    return { outcome: "expired", locale };
  }

  const { error: updateError } = await supabase
    .from("requests")
    .update({
      verified_at: new Date().toISOString(),
      status: "verified",
      verify_token: null, // un solo uso
      verify_expires_at: null,
    })
    .eq("id", row.id);

  if (updateError) {
    console.error("[/verify] actualizacion fallo:", updateError);
    return { outcome: "invalid", locale };
  }

  return { outcome: "ok", locale };
}

export default async function VerifyPage({ searchParams }: PageProps<"/verify">) {
  const { token } = await searchParams;
  const { outcome, locale: requestLocale } = await consumeToken(
    typeof token === "string" ? token : undefined,
  );

  const locale = requestLocale ?? (await getLocale());
  const messages = getMessages(locale);
  const tr = translator(messages);

  const copy = {
    ok: { title: tr("verify.okTitle"), body: tr("verify.okBody") },
    expired: { title: tr("verify.expiredTitle"), body: tr("verify.expiredBody") },
    invalid: { title: tr("verify.invalidTitle"), body: tr("verify.invalidBody") },
  }[outcome];

  return (
    <>
      <SiteHeader locale={locale} messages={messages} />

      <main className="mx-auto w-full max-w-[640px] px-5 py-16">
        <div className="rounded-card border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(26,26,25,0.04)] sm:p-8">
          <span
            aria-hidden="true"
            className={
              "mb-5 block h-1.5 w-10 rounded-full " + (outcome === "ok" ? "bg-accent" : "bg-line")
            }
          />
          <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-ink">{copy.title}</h1>
          <p className="mt-2.5 text-[15px] leading-relaxed text-muted">{copy.body}</p>

          {outcome === "ok" ? (
            // Dia 2-3: aqui arranca el job del informe y se redirige a la pagina de espera.
            <div className="mt-6 rounded-[10px] bg-paper p-4">
              <p className="text-[14px] font-medium text-ink">{tr("verify.soonTitle")}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{tr("verify.soonBody")}</p>
            </div>
          ) : (
            <Link
              href="/#form"
              className="mt-6 inline-block rounded-[10px] bg-accent px-5 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              {tr("verify.retry")}
            </Link>
          )}
        </div>
      </main>

      <SiteFooter messages={messages} />
    </>
  );
}
