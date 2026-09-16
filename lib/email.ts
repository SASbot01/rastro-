import { Resend } from "resend";
import { serverEnv } from "@/lib/env";
import { getMessages, translator, type Locale } from "@/lib/i18n";

const ACCENT = "#4dfc5f";
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

/** Aviso de la comprobación diaria: brechas o pastes nuevos con el correo. */
export async function sendDailyEmail(opts: {
  to: string;
  name: string;
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
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(tr("dailyEmail.preheader"))}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 16px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#151515;border:1px solid ${LINE};border-radius:20px;">
      <tr><td style="padding:32px 32px 8px;font:600 15px/1.4 ${font};color:${INK};">Rastro</td></tr>
      <tr><td style="padding:8px 32px 0;font:400 16px/1.6 ${font};color:${INK};">
        <p style="margin:0 0 12px;">${escapeHtml(tr("dailyEmail.greeting", { name: opts.name }))}</p>
        <p style="margin:0 0 16px;color:${MUTED};">${escapeHtml(tr("dailyEmail.intro"))}</p>
        <ul style="margin:0 0 24px;padding-left:20px;color:${INK};">${items}</ul>
      </td></tr>
      <tr><td style="padding:0 32px;"><a href="${escapeHtml(opts.reportUrl)}" style="display:block;text-align:center;background:${ACCENT};color:#0a0a0a;text-decoration:none;font:600 16px/1 ${font};padding:16px 20px;border-radius:10px;">${escapeHtml(tr("dailyEmail.cta"))}</a></td></tr>
      <tr><td style="padding:24px 32px 32px;font:400 12px/1.6 ${font};color:${MUTED};">
        <p style="margin:0 0 6px;">${escapeHtml(tr("dailyEmail.footer"))}</p>
        <p style="margin:0;"><a href="${escapeHtml(opts.unsubscribeUrl)}" style="color:${MUTED};">${escapeHtml(tr("dailyEmail.unsubscribe"))}</a></p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  const text = [tr("dailyEmail.greeting", { name: opts.name }), "", tr("dailyEmail.intro"), "", ...opts.lines.map((l) => `- ${l}`), "", `${tr("dailyEmail.cta")}: ${opts.reportUrl}`, "", tr("dailyEmail.footer"), opts.unsubscribeUrl].join("\n");

  if (!serverEnv.isProduction) console.log(`\n[rastro] Correo de comprobación diaria para ${opts.to}\n[rastro] ${opts.reportUrl}\n${opts.lines.map((l) => "[rastro]   - " + l).join("\n")}\n`);
  if (!process.env.RESEND_API_KEY) {
    if (!serverEnv.isProduction) return;
    throw new Error("Falta RESEND_API_KEY");
  }
  const { error } = await resend().emails.send({
    from: serverEnv.resendFrom,
    to: opts.to,
    subject: tr("dailyEmail.subject"),
    html,
    text,
  });
  if (error) {
    if (!serverEnv.isProduction) return console.warn(`[rastro] Resend no envio el correo diario (${error.message})`);
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


/** Remitente de las cartas RGPD: cartas@<dominio verificado>, con el nombre "Rastro". */
function lettersFrom(): string {
  if (process.env.LETTERS_FROM) return process.env.LETTERS_FROM;
  const m = serverEnv.resendFrom.match(/<([^>]+)>/);
  const addr = m ? m[1] : serverEnv.resendFrom;
  const domain = addr.split("@")[1] ?? "rastropro.com";
  return `Rastro <cartas@${domain}>`;
}

/**
 * Envia una carta RGPD al sitio en nombre del usuario: respuesta al usuario
 * (reply-to) y copia para el (cc). Fuera de produccion NUNCA se envia: se
 * registra y se devuelve un id ficticio (para no mandar cartas reales en pruebas).
 */
export async function sendLetterEmail(opts: { to: string; user: string; subject: string; body: string }): Promise<{ id: string }> {
  if (!serverEnv.isProduction) {
    console.log(`\n[rastro] (no enviado: entorno de pruebas) Carta a ${opts.to}, copia a ${opts.user}\n[rastro] ${opts.subject}\n`);
    return { id: `dev-${Date.now()}` };
  }
  if (!process.env.RESEND_API_KEY) throw new Error("Falta RESEND_API_KEY");
  const html = `<pre style="font:15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;white-space:pre-wrap;color:#111;">${escapeHtml(opts.body)}</pre>`;
  const { data, error } = await resend().emails.send({
    from: lettersFrom(),
    to: opts.to,
    cc: opts.user,
    replyTo: opts.user,
    subject: opts.subject,
    text: opts.body,
    html,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  return { id: data?.id ?? "" };
}

/** Aviso al usuario: Rastro ha reenviado su carta como recordatorio. */
export async function sendFollowUpNoticeEmail(opts: { to: string; name: string; host: string; deadlineAt: string; letterUrl: string; locale: Locale }): Promise<void> {
  const tr = translator(getMessages(opts.locale));
  const fmt = new Intl.DateTimeFormat(opts.locale, { dateStyle: "long" });
  const vars = { name: opts.name, host: opts.host, deadline: fmt.format(new Date(opts.deadlineAt)) };
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif";
  const html = `<!doctype html><html lang="${opts.locale}"><head><meta charset="utf-8"><title>Rastro</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 16px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#151515;border:1px solid ${LINE};border-radius:20px;">
      <tr><td style="padding:32px 32px 8px;font:600 15px/1.4 ${font};color:${INK};">Rastro</td></tr>
      <tr><td style="padding:8px 32px 0;font:400 16px/1.6 ${font};color:${INK};">
        <p style="margin:0 0 12px;">${escapeHtml(tr("followUpEmail.greeting", vars))}</p>
        <p style="margin:0 0 12px;">${escapeHtml(tr("followUpEmail.body", vars))}</p>
        <p style="margin:0 0 24px;color:${MUTED};">${escapeHtml(tr("followUpEmail.ask", vars))}</p>
      </td></tr>
      <tr><td style="padding:0 32px;"><a href="${escapeHtml(opts.letterUrl)}" style="display:block;text-align:center;background:${ACCENT};color:#0a0a0a;text-decoration:none;font:600 16px/1 ${font};padding:16px 20px;border-radius:10px;">${escapeHtml(tr("followUpEmail.cta"))}</a></td></tr>
      <tr><td style="padding:24px 32px 32px;font:400 12px/1.6 ${font};color:${MUTED};">${escapeHtml(tr("followUpEmail.footer"))}</td></tr>
    </table>
  </td></tr></table></body></html>`;
  const text = [tr("followUpEmail.greeting", vars), "", tr("followUpEmail.body", vars), "", tr("followUpEmail.ask", vars), "", `${tr("followUpEmail.cta")}: ${opts.letterUrl}`].join("\n");
  if (!serverEnv.isProduction) console.log(`\n[rastro] Aviso de recordatorio para ${opts.to}: ${opts.letterUrl}\n`);
  if (!process.env.RESEND_API_KEY) {
    if (!serverEnv.isProduction) return;
    throw new Error("Falta RESEND_API_KEY");
  }
  const { error } = await resend().emails.send({ from: serverEnv.resendFrom, to: opts.to, subject: tr("followUpEmail.subject", vars), html, text });
  if (error) {
    if (!serverEnv.isProduction) return console.warn(`[rastro] Resend no envio el aviso de recordatorio (${error.message})`);
    throw new Error(`Resend: ${error.message}`);
  }
}


/** Aviso generico con un boton: saludo, parrafos, CTA. Lo usan las invitaciones del plan familiar y avisos futuros. */
export async function sendNoticeEmail(opts: { to: string; subject: string; greeting: string; paragraphs: string[]; cta: string; url: string; footer: string }): Promise<void> {
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Rastro</title></head>
<body style="margin:0;padding:0;background:${PAPER};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};padding:32px 16px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#151515;border:1px solid ${LINE};border-radius:20px;">
      <tr><td style="padding:32px 32px 8px;font:600 15px/1.4 ${font};color:${INK};">Rastro</td></tr>
      <tr><td style="padding:8px 32px 0;font:400 16px/1.6 ${font};color:${INK};">
        <p style="margin:0 0 12px;">${escapeHtml(opts.greeting)}</p>
        ${opts.paragraphs.map((t, i) => `<p style="margin:0 0 ${i === opts.paragraphs.length - 1 ? 24 : 12}px;${i > 0 ? `color:${MUTED};` : ""}">${escapeHtml(t)}</p>`).join("")}
      </td></tr>
      <tr><td style="padding:0 32px;"><a href="${escapeHtml(opts.url)}" style="display:block;text-align:center;background:${ACCENT};color:#0a0a0a;text-decoration:none;font:600 16px/1 ${font};padding:16px 20px;border-radius:10px;">${escapeHtml(opts.cta)}</a></td></tr>
      <tr><td style="padding:24px 32px 32px;font:400 12px/1.6 ${font};color:${MUTED};">${escapeHtml(opts.footer)}</td></tr>
    </table>
  </td></tr></table></body></html>`;
  const text = [opts.greeting, "", ...opts.paragraphs, "", `${opts.cta}: ${opts.url}`, "", opts.footer].join("\n");
  if (!serverEnv.isProduction) console.log(`\n[rastro] Aviso para ${opts.to}: ${opts.subject}\n[rastro] ${opts.url}\n`);
  if (!process.env.RESEND_API_KEY) {
    if (!serverEnv.isProduction) return;
    throw new Error("Falta RESEND_API_KEY");
  }
  const { error } = await resend().emails.send({ from: serverEnv.resendFrom, to: opts.to, subject: opts.subject, html, text });
  if (error) {
    if (!serverEnv.isProduction) return console.warn(`[rastro] Resend no envio el aviso (${error.message})`);
    throw new Error(`Resend: ${error.message}`);
  }
}


/**
 * Mensaje de phishing SIMULADO enviado al propio usuario (v2). Va marcado en
 * asunto, cabecera y pie, con las pistas al final. Solo se envia a la cuenta
 * que lo pidio; el "remitente" simulado aparece en el cuerpo, no en el From.
 */
export async function sendSimulatedPhishingEmail(opts: { to: string; subject: string; fromName: string; body: string; clues: string[]; index: number; locale: Locale }): Promise<void> {
  const tr = translator(getMessages(opts.locale));
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif";
  const html = `<!doctype html><html lang="${opts.locale}"><head><meta charset="utf-8"><title>${escapeHtml(opts.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 16px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;">
      <tr><td style="padding:10px 24px;background:${ACCENT};color:#0a0a0a;font:600 12px/1.4 ${font};letter-spacing:.08em;border-radius:12px 12px 0 0;">${escapeHtml(tr("sim.emailBanner", { n: opts.index }))}</td></tr>
      <tr><td style="padding:20px 24px 4px;font:600 13px/1.4 ${font};color:#666;">${escapeHtml(tr("sim.simulatedFrom", { name: opts.fromName }))}</td></tr>
      <tr><td style="padding:8px 24px 20px;font:400 15px/1.6 ${font};color:#111;white-space:pre-wrap;">${escapeHtml(opts.body)}</td></tr>
      <tr><td style="padding:16px 24px 24px;border-top:1px dashed #ddd;font:400 13px/1.6 ${font};color:#444;">
        <p style="margin:0 0 6px;font-weight:600;">${escapeHtml(tr("sim.cluesTitle"))}</p>
        <ul style="margin:0;padding-left:18px;">${opts.clues.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
        <p style="margin:12px 0 0;color:#888;">${escapeHtml(tr("sim.emailFooter"))}</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
  const text = [tr("sim.emailBanner", { n: opts.index }), tr("sim.simulatedFrom", { name: opts.fromName }), "", opts.body, "", tr("sim.cluesTitle"), ...opts.clues.map((c) => `- ${c}`), "", tr("sim.emailFooter")].join("\n");
  if (!serverEnv.isProduction) console.log(`\n[rastro] Phishing simulado #${opts.index} para ${opts.to}: ${opts.subject}\n`);
  if (!process.env.RESEND_API_KEY) {
    if (!serverEnv.isProduction) return;
    throw new Error("Falta RESEND_API_KEY");
  }
  const { error } = await resend().emails.send({ from: serverEnv.resendFrom, to: opts.to, subject: opts.subject, html, text });
  if (error) {
    if (!serverEnv.isProduction) return console.warn(`[rastro] Resend no envio el phishing simulado (${error.message})`);
    throw new Error(`Resend: ${error.message}`);
  }
}
