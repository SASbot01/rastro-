import { Resend } from "resend";
import { serverEnv } from "@/lib/env";
import { getMessages, translator, type Locale } from "@/lib/i18n";

const ACCENT = "#c8ff3d";
const INK = "#f4f4f2";
const MUTED = "#a3a39e";
const LINE = "#262626";
const PAPER = "#0a0a0a";

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

type MagicKind = "verify" | "login";

/** Copia del correo segun el tipo de enlace: email.* (verificacion) o loginEmail.* (acceso). */
function copyFor(kind: MagicKind, locale: Locale, name: string) {
  const tr = translator(getMessages(locale));
  const ns = kind === "verify" ? "email" : "loginEmail";
  return {
    subject: tr(`${ns}.subject`),
    preheader: tr(`${ns}.preheader`),
    greeting: tr(`${ns}.greeting`, { name }),
    body: tr(`${ns}.body`),
    cta: tr(`${ns}.cta`),
    fallback: tr(`${ns}.fallback`),
    expires: tr(`${ns}.expires`),
    ignore: tr(`${ns}.ignore`),
    footer: tr("email.footer"),
  };
}

function magicLinkHtml(opts: { kind: MagicKind; name: string; url: string; locale: Locale; code?: string }): string {
  const c = copyFor(opts.kind, opts.locale, opts.name);
  const tr = (key: keyof typeof c) => c[key];
  const url = escapeHtml(opts.url);
  const t = translator(getMessages(opts.locale));
  const codeBlock = opts.code
    ? `<tr><td style="padding:24px 32px 0;font:400 14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:${MUTED};">
          <p style="margin:0 0 8px;">${escapeHtml(t(opts.kind === "login" ? "loginEmail.codeIntro" : "email.codeIntro"))}</p>
          <p style="margin:0;font:700 32px/1.2 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;letter-spacing:0.18em;color:${INK};">${escapeHtml(opts.code)}</p>
        </td></tr>`
    : "";

  return `<!doctype html>
<html lang="${opts.locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Rastro</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(tr("preheader"))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#151515;border:1px solid ${LINE};border-radius:20px;">
        <tr><td style="padding:32px 32px 8px;font:600 15px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;letter-spacing:-0.01em;color:${INK};">
          Rastro
        </td></tr>
        <tr><td style="padding:8px 32px 0;font:400 16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:${INK};">
          <p style="margin:0 0 12px;">${escapeHtml(tr("greeting"))}</p>
          <p style="margin:0 0 24px;color:${MUTED};">${escapeHtml(tr("body"))}</p>
        </td></tr>
        <tr><td style="padding:0 32px;">
          <a href="${url}" style="display:block;text-align:center;background:${ACCENT};color:#0a0a0a;text-decoration:none;font:600 16px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;padding:16px 20px;border-radius:10px;">${escapeHtml(tr("cta"))}</a>
        </td></tr>
        ${codeBlock}
        <tr><td style="padding:24px 32px 0;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:${MUTED};">
          <p style="margin:0 0 6px;">${escapeHtml(tr("fallback"))}</p>
          <p style="margin:0 0 20px;word-break:break-all;"><a href="${url}" style="color:${ACCENT};">${url}</a></p>
          <p style="margin:0 0 6px;">${escapeHtml(tr("expires"))}</p>
          <p style="margin:0;">${escapeHtml(tr("ignore"))}</p>
        </td></tr>
        <tr><td style="padding:24px 32px 32px;">
          <div style="border-top:1px solid ${LINE};padding-top:16px;font:400 12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:${MUTED};">${escapeHtml(tr("footer"))}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function magicLinkText(opts: { kind: MagicKind; name: string; url: string; locale: Locale; code?: string }): string {
  const c = copyFor(opts.kind, opts.locale, opts.name);
  const t = translator(getMessages(opts.locale));
  const codeLines = opts.code ? ["", t(opts.kind === "login" ? "loginEmail.codeIntro" : "email.codeIntro"), opts.code] : [];
  return [c.greeting, "", c.body, "", `${c.cta}: ${opts.url}`, ...codeLines, "", c.expires, c.ignore, "", c.footer].join("\n");
}

export function sendVerifyEmail(opts: { to: string; name: string; url: string; locale: Locale; code?: string }): Promise<void> {
  return sendMagicLink({ kind: "verify", ...opts });
}

export function sendLoginEmail(opts: { to: string; url: string; locale: Locale; code?: string }): Promise<void> {
  return sendMagicLink({ kind: "login", name: "", ...opts });
}

async function sendMagicLink(opts: {
  kind: MagicKind;
  to: string;
  name: string;
  url: string;
  locale: Locale;
  code?: string;
}): Promise<void> {
  const dev = !serverEnv.isProduction;

  // En desarrollo el enlace SIEMPRE sale por consola: sin dominio verificado,
  // Resend solo entrega a la direccion duena de la cuenta, y asi se puede
  // probar el flujo con cualquier correo.
  if (dev) {
    console.log(`\n[rastro] Enlace (${opts.kind}) para ${opts.to}\n[rastro] ${opts.url}${opts.code ? `\n[rastro] codigo: ${opts.code}` : ""}\n`);
  }
  if (!process.env.RESEND_API_KEY) {
    if (dev) return;
    throw new Error("Falta RESEND_API_KEY");
  }

  const { error } = await resend().emails.send({
    from: serverEnv.resendFrom,
    to: opts.to,
    subject: copyFor(opts.kind, opts.locale, opts.name).subject,
    html: magicLinkHtml(opts),
    text: magicLinkText(opts),
  });
  if (error) {
    // En desarrollo, un rechazo de Resend (p. ej. destinatario no permitido)
    // no rompe el flujo: el enlace ya esta en consola. En produccion, si.
    if (dev) {
      console.warn(`[rastro] Resend no envio el correo (${error.message}); usa el enlace de consola.`);
      return;
    }
    throw new Error(`Resend: ${error.message}`);
  }
}

/** Correo mensual de novedades. `lines` ya vienen traducidas (lib/report/diff.ts). */
export async function sendMonitorEmail(opts: {
  to: string;
  name: string;
  score: number;
  lines: string[];
  reportUrl: string;
  unsubscribeUrl: string;
  locale: Locale;
}): Promise<void> {
  const tr = translator(getMessages(opts.locale));
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif";
  const items = opts.lines.map((l) => `<li style="margin:0 0 8px;">${escapeHtml(l)}</li>`).join("");
  const html = `<!doctype html><html lang="${opts.locale}"><head><meta charset="utf-8"><title>Rastro</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(tr("monitorEmail.preheader"))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 16px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#151515;border:1px solid ${LINE};border-radius:20px;">
      <tr><td style="padding:32px 32px 8px;font:600 15px/1.4 ${font};color:${INK};">Rastro</td></tr>
      <tr><td style="padding:8px 32px 0;font:400 16px/1.6 ${font};color:${INK};">
        <p style="margin:0 0 12px;">${escapeHtml(tr("monitorEmail.greeting", { name: opts.name }))}</p>
        <p style="margin:0 0 16px;color:${MUTED};">${escapeHtml(tr("monitorEmail.intro"))}</p>
        <ul style="margin:0 0 24px;padding-left:20px;color:${INK};">${items}</ul>
      </td></tr>
      <tr><td style="padding:0 32px;"><a href="${escapeHtml(opts.reportUrl)}" style="display:block;text-align:center;background:${ACCENT};color:#0a0a0a;text-decoration:none;font:600 16px/1 ${font};padding:16px 20px;border-radius:10px;">${escapeHtml(tr("monitorEmail.cta"))}</a></td></tr>
      <tr><td style="padding:24px 32px 32px;font:400 12px/1.6 ${font};color:${MUTED};">
        <p style="margin:0 0 6px;">${escapeHtml(tr("monitorEmail.footer"))}</p>
        <p style="margin:0;"><a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:${MUTED};">${escapeHtml(tr("monitorEmail.unsubscribe"))}</a></p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  const text = [tr("monitorEmail.greeting", { name: opts.name }), "", tr("monitorEmail.intro"), "", ...opts.lines.map((l) => `- ${l}`), "", `${tr("monitorEmail.cta")}: ${opts.reportUrl}`, "", tr("monitorEmail.footer"), opts.unsubscribeUrl].join("\n");

  if (!serverEnv.isProduction) console.log(`\n[rastro] Correo de novedades para ${opts.to}\n[rastro] ${opts.reportUrl}\n${opts.lines.map((l) => "[rastro]   - " + l).join("\n")}\n`);
  if (!process.env.RESEND_API_KEY) {
    if (!serverEnv.isProduction) return;
    throw new Error("Falta RESEND_API_KEY");
  }
  const { error } = await resend().emails.send({
    from: serverEnv.resendFrom,
    to: opts.to,
    subject: tr("monitorEmail.subject", { score: opts.score }),
    html,
    text,
  });
  if (error) {
    if (!serverEnv.isProduction) return console.warn(`[rastro] Resend no envio el correo de novedades (${error.message})`);
    throw new Error(`Resend: ${error.message}`);
  }
}

/** Aviso de plazo vencido de una carta RGPD (cron diario). */
export async function sendDeadlineEmail(opts: {
  to: string;
  name: string;
  host: string;
  sentAt: string;
  deadlineAt: string;
  letterUrl: string;
  locale: Locale;
}): Promise<void> {
  const tr = translator(getMessages(opts.locale));
  const fmt = new Intl.DateTimeFormat(opts.locale, { dateStyle: "long" });
  const vars = { name: opts.name, host: opts.host, sent: fmt.format(new Date(opts.sentAt)), deadline: fmt.format(new Date(opts.deadlineAt)) };
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif";
  const html = `<!doctype html><html lang="${opts.locale}"><head><meta charset="utf-8"><title>Rastro</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(tr("deadlineEmail.preheader"))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 16px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#151515;border:1px solid ${LINE};border-radius:20px;">
      <tr><td style="padding:32px 32px 8px;font:600 15px/1.4 ${font};color:${INK};">Rastro</td></tr>
      <tr><td style="padding:8px 32px 0;font:400 16px/1.6 ${font};color:${INK};">
        <p style="margin:0 0 12px;">${escapeHtml(tr("deadlineEmail.greeting", vars))}</p>
        <p style="margin:0 0 12px;">${escapeHtml(tr("deadlineEmail.body", vars))}</p>
        <p style="margin:0 0 24px;color:${MUTED};">${escapeHtml(tr("deadlineEmail.ask"))}</p>
      </td></tr>
      <tr><td style="padding:0 32px;"><a href="${escapeHtml(opts.letterUrl)}" style="display:block;text-align:center;background:${ACCENT};color:#0a0a0a;text-decoration:none;font:600 16px/1 ${font};padding:16px 20px;border-radius:10px;">${escapeHtml(tr("deadlineEmail.cta"))}</a></td></tr>
      <tr><td style="padding:24px 32px 32px;font:400 12px/1.6 ${font};color:${MUTED};">${escapeHtml(tr("deadlineEmail.footer"))}</td></tr>
    </table>
  </td></tr></table></body></html>`;
  const text = [tr("deadlineEmail.greeting", vars), "", tr("deadlineEmail.body", vars), "", tr("deadlineEmail.ask"), "", `${tr("deadlineEmail.cta")}: ${opts.letterUrl}`, "", tr("deadlineEmail.footer")].join("\n");

  if (!serverEnv.isProduction) console.log(`\n[rastro] Aviso de plazo vencido para ${opts.to} (${opts.host})\n[rastro] ${opts.letterUrl}\n`);
  if (!process.env.RESEND_API_KEY) {
    if (!serverEnv.isProduction) return;
    throw new Error("Falta RESEND_API_KEY");
  }
  const { error } = await resend().emails.send({ from: serverEnv.resendFrom, to: opts.to, subject: tr("deadlineEmail.subject", vars), html, text });
  if (error) {
    if (!serverEnv.isProduction) return console.warn(`[rastro] Resend no envio el aviso de plazo (${error.message})`);
    throw new Error(`Resend: ${error.message}`);
  }
}

/** Mensaje de soporte: llega al equipo y una copia de acuse al usuario. */
export async function sendSupportEmail(opts: { from: string; subject: string; message: string; locale: Locale; page?: string | null }): Promise<void> {
  const tr = translator(getMessages(opts.locale));
  const to = process.env.SUPPORT_EMAIL || process.env.NEXT_PUBLIC_LEGAL_EMAIL;
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif";
  const body = escapeHtml(opts.message).replace(/\n/g, "<br>");
  const text = `De: ${opts.from}\n${opts.page ? `Pantalla: ${opts.page}\n` : ""}\n${opts.message}`;

  if (!serverEnv.isProduction) console.log(`\n[rastro] Soporte de ${opts.from}: ${opts.subject}\n${opts.message}\n`);
  if (!process.env.RESEND_API_KEY) {
    if (!serverEnv.isProduction) return;
    throw new Error("Falta RESEND_API_KEY");
  }
  if (!to) throw new Error("Falta SUPPORT_EMAIL");

  await resend().emails.send({
    from: serverEnv.resendFrom,
    to,
    replyTo: opts.from,
    subject: tr("supportEmail.subject", { subject: opts.subject }),
    html: `<div style="font:400 15px/1.6 ${font};color:${INK};background:${PAPER};padding:24px;"><p style="margin:0 0 8px;color:${MUTED};">De: ${escapeHtml(opts.from)}${opts.page ? ` · ${escapeHtml(opts.page)}` : ""}</p><p style="margin:0;">${body}</p></div>`,
    text,
  });
  const ack = await resend().emails.send({
    from: serverEnv.resendFrom,
    to: opts.from,
    subject: tr("supportEmail.ackSubject"),
    html: `<div style="font:400 15px/1.6 ${font};color:${INK};background:${PAPER};padding:24px;"><p style="margin:0 0 12px;">${escapeHtml(tr("supportEmail.ackBody"))}</p><p style="margin:0 0 4px;font-weight:600;">${escapeHtml(opts.subject)}</p><p style="margin:0;color:${MUTED};">${body}</p><p style="margin:24px 0 0;font-size:12px;color:${MUTED};">${escapeHtml(tr("supportEmail.footer"))}</p></div>`,
    text: `${tr("supportEmail.ackBody")}\n\n${opts.subject}\n${opts.message}\n\n${tr("supportEmail.footer")}`,
  });
  if (ack.error && serverEnv.isProduction) console.warn("[soporte] acuse no enviado:", ack.error.message);
}
