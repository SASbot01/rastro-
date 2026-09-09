import { Resend } from "resend";
import { serverEnv } from "@/lib/env";
import { getMessages, translator, type Locale } from "@/lib/i18n";

const ACCENT = "#E8590C";
const INK = "#1A1A19";
const MUTED = "#6B6B66";
const LINE = "#E7E4DE";
const PAPER = "#FAF9F7";

let client: Resend | null = null;
function resend(): Resend {
  if (!client) client = new Resend(serverEnv.resendApiKey);
  return client;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function verifyEmailHtml(opts: { name: string; url: string; locale: Locale }): string {
  const tr = translator(getMessages(opts.locale));
  const name = escapeHtml(opts.name);
  const url = escapeHtml(opts.url);

  return `<!doctype html>
<html lang="${opts.locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Rastro</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(tr("email.preheader"))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid ${LINE};border-radius:14px;">
        <tr><td style="padding:32px 32px 8px;font:600 15px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;letter-spacing:-0.01em;color:${INK};">
          Rastro
        </td></tr>
        <tr><td style="padding:8px 32px 0;font:400 16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:${INK};">
          <p style="margin:0 0 12px;">${escapeHtml(tr("email.greeting", { name }))}</p>
          <p style="margin:0 0 24px;color:${MUTED};">${escapeHtml(tr("email.body"))}</p>
        </td></tr>
        <tr><td style="padding:0 32px;">
          <a href="${url}" style="display:block;text-align:center;background:${ACCENT};color:#FFFFFF;text-decoration:none;font:600 16px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;padding:16px 20px;border-radius:10px;">${escapeHtml(tr("email.cta"))}</a>
        </td></tr>
        <tr><td style="padding:24px 32px 0;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:${MUTED};">
          <p style="margin:0 0 6px;">${escapeHtml(tr("email.fallback"))}</p>
          <p style="margin:0 0 20px;word-break:break-all;"><a href="${url}" style="color:${ACCENT};">${url}</a></p>
          <p style="margin:0 0 6px;">${escapeHtml(tr("email.expires"))}</p>
          <p style="margin:0;">${escapeHtml(tr("email.ignore"))}</p>
        </td></tr>
        <tr><td style="padding:24px 32px 32px;">
          <div style="border-top:1px solid ${LINE};padding-top:16px;font:400 12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:${MUTED};">${escapeHtml(tr("email.footer"))}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function verifyEmailText(opts: { name: string; url: string; locale: Locale }): string {
  const tr = translator(getMessages(opts.locale));
  return [
    tr("email.greeting", { name: opts.name }),
    "",
    tr("email.body"),
    "",
    `${tr("email.cta")}: ${opts.url}`,
    "",
    tr("email.expires"),
    tr("email.ignore"),
    "",
    tr("email.footer"),
  ].join("\n");
}

export async function sendVerifyEmail(opts: {
  to: string;
  name: string;
  url: string;
  locale: Locale;
}): Promise<void> {
  // Modo local sin Resend: el enlace se imprime en la terminal en vez de
  // enviarse. Solo fuera de produccion y solo si no hay clave configurada.
  if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production") {
    console.log(
      `\n[rastro] Sin RESEND_API_KEY: enlace de verificacion para ${opts.to}\n` +
        `[rastro] ${opts.url}\n`,
    );
    return;
  }

  const tr = translator(getMessages(opts.locale));
  const { error } = await resend().emails.send({
    from: serverEnv.resendFrom,
    to: opts.to,
    subject: tr("email.subject"),
    html: verifyEmailHtml(opts),
    text: verifyEmailText(opts),
  });
  if (error) {
    throw new Error(`Resend: ${error.message}`);
  }
}
