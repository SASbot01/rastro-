import { supabaseAdmin } from "@/lib/supabase";
import { revokeToken } from "@/lib/google";

/**
 * Escaneo del buzon: busca correos tipicos de alta/cuenta/recibo/newsletter,
 * lee SOLO cabeceras (From, Subject, Date, List-Unsubscribe) y agrupa por
 * dominio del remitente. Resultado: lista de servicios con los que el correo
 * tiene relacion. No se guarda ningun correo.
 */

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const PAGE = 500;
const MAX_PER_QUERY = 400;
const CONCURRENCY = 3; // lotes en paralelo
const BATCH_SIZE = 50; // cabeceras por peticion (Gmail recomienda <= 50)

/**
 * Palabras clave (asunto) que delatan una relacion con un servicio.
 * Anadir aqui lo que haga falta; se agrupan en consultas de Gmail.
 */
const KEYWORDS_ACCOUNT = [
  // altas y registro
  "welcome", "welcome to", "bienvenido", "bienvenida", "bienvenido a", "gracias por registrarte", "thanks for signing up",
  "sign up", "signed up", "registro", "registrado", "cuenta creada", "account created", "new account", "nueva cuenta",
  "your account", "tu cuenta", "activate", "activa tu cuenta", "activación",
  // verificacion
  "verify", "verifica", "verify your", "verifica tu", "confirm your", "confirma tu", "confirmación", "confirmation",
  "verification code", "código de verificación", "codigo de verificacion", "código de acceso", "one-time", "otp",
  // inicio de sesion y seguridad
  "inicio de sesión", "inicio de sesion", "sign in", "sign-in", "signed in", "login", "log in", "new login", "nuevo inicio de sesión",
  "security alert", "alerta de seguridad", "password", "contraseña", "reset your password", "restablecer", "cambio de contraseña",
  // suscripciones y pruebas
  "trial", "prueba gratuita", "membership", "membresía", "suscripción", "subscription", "renewal", "renovación", "plan",
];
const KEYWORDS_RECEIPT = [
  "receipt", "recibo", "factura", "invoice", "your order", "tu pedido", "order confirmation", "confirmación de pedido",
  "payment", "pago", "pago recibido", "payment received", "purchase", "compra", "booking", "reserva", "envío", "shipped",
];

function quote(k: string): string {
  return /\s/.test(k) ? `"${k}"` : k;
}
/** Gmail admite OR largos, pero mejor en trozos de ~25 terminos. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
const QUERIES = [...KEYWORDS_ACCOUNT, ...KEYWORDS_RECEIPT].length
  ? [...chunk(KEYWORDS_ACCOUNT, 25), ...chunk(KEYWORDS_RECEIPT, 25)].map((ks) => `subject:(${ks.map(quote).join(" OR ")})`)
  : [];

/** Proveedores de correo personal: son personas, no servicios. */
const PERSONAL = new Set(["gmail.com", "googlemail.com", "hotmail.com", "hotmail.es", "outlook.com", "outlook.es", "live.com", "msn.com", "yahoo.com", "yahoo.es", "icloud.com", "me.com", "mac.com", "protonmail.com", "proton.me", "aol.com", "gmx.com", "gmx.es", "telefonica.net", "movistar.es"]);
/** Subdominios de envio que no identifican al servicio. */
const MAIL_SUBS = /^(mail|email|e|em|eml|m|mg|mailer|news|newsletter|noreply|no-reply|notify|notification|notifications|info|hello|hi|support|help|account|accounts|alerts?|updates?|team|contact|marketing|promo|cs|customer|service|info-|send|smtp|bounce|bounces|reply|do-not-reply|donotreply)\./i;
/** Dominios de envio que pertenecen a otro servicio conocido. */
const ALIASES: Record<string, string> = {
  "facebookmail.com": "facebook.com", "instagram.com": "instagram.com", "fbmail.com": "facebook.com",
  "linkedinmail.com": "linkedin.com", "amazon.es": "amazon.com", "amazon.co.uk": "amazon.com", "amazon.de": "amazon.com",
  "accounts.google.com": "google.com", "youtube.com": "google.com", "microsoftonline.com": "microsoft.com", "azure.com": "microsoft.com",
  "office.com": "microsoft.com", "live.com": "microsoft.com", "paypal.es": "paypal.com", "apple.com": "apple.com", "icloud.com": "apple.com",
  "twitter.com": "x.com", "x.com": "x.com", "wallapop.com": "wallapop.com",
};
/** Infraestructura de envio o herramientas de desarrollo: no son "una cuenta" del usuario. */
const INFRA = new Set(["resend.dev", "amazonses.com", "sendgrid.net", "mailgun.org", "mailchimp.com", "mcsv.net", "sparkpostmail.com", "postmarkapp.com", "mandrillapp.com", "hubspotemail.net", "list-manage.com"]);

const TWO_LEVEL_TLDS = new Set(["co.uk", "com.ar", "com.mx", "com.br", "com.co", "com.au", "co.jp", "co.nz", "org.uk", "com.es"]);

const ACCOUNT_RE = /welcome|bienvenid|verif|confirm|your account|tu cuenta|activat|activa|sign ?up|registro|new account|nueva cuenta|reset|restablec|contraseña|password|código|codigo|code/i;
const RECEIPT_RE = /receipt|recibo|factura|invoice|order|pedido|payment|pago|suscripci|subscription|renewal|renovaci/i;

export interface MailboxService {
  domain: string;
  name: string;
  kind: "account" | "receipt" | "newsletter" | "other";
  first_seen: string | null;
  last_seen: string | null;
  messages: number;
  sample_subject: string | null;
}

interface Header { name: string; value: string }
interface Msg { id: string; payload?: { headers?: Header[] } }

function registrable(host: string): string {
  const parts = host.toLowerCase().split(".");
  if (parts.length <= 2) return parts.join(".");
  const last2 = parts.slice(-2).join(".");
  return TWO_LEVEL_TLDS.has(last2) ? parts.slice(-3).join(".") : last2;
}

function parseFrom(from: string): { name: string; domain: string } | null {
  const m = from.match(/^(.*?)<([^>]+)>\s*$/);
  const addr = (m ? m[2] : from).trim().toLowerCase();
  const name = (m ? m[1] : "").replace(/^"|"$/g, "").replace(/"/g, "").trim();
  const at = addr.lastIndexOf("@");
  if (at < 0) return null;
  let host = addr.slice(at + 1);
  host = host.replace(MAIL_SUBS, "");
  const reg = registrable(host);
  return { name, domain: ALIASES[reg] ?? reg };
}

async function gmail<T>(token: string, path: string, attempt = 0): Promise<T> {
  const res = await fetch(`${GMAIL}/${path}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  if (res.ok) return (await res.json()) as T;

  // Gmail avisa del limite de peticiones con 403 (userRateLimitExceeded), no solo con 429.
  const body = await res.text().catch(() => "");
  const retryable = res.status === 429 || res.status >= 500 || (res.status === 403 && /rate|quota|limit/i.test(body));
  if (retryable && attempt < 6) {
    await new Promise((r) => setTimeout(r, Math.min(15_000, 500 * 2 ** attempt) + Math.random() * 300));
    return gmail<T>(token, path, attempt + 1);
  }
  const reason = body.match(/"reason":\s*"([^"]+)"/)?.[1] ?? body.match(/"message":\s*"([^"]+)"/)?.[1] ?? "";
  throw new Error(`gmail ${path.split("?")[0]}: HTTP ${res.status} ${reason}`.trim());
}

/**
 * Lote de Gmail: hasta 50 messages.get en una sola peticion HTTP (multipart).
 * Devuelve los mensajes que hayan respondido 200; los demas se ignoran.
 */
async function gmailBatch(token: string, ids: string[], attempt = 0): Promise<Msg[]> {
  const boundary = `rastro_${Math.random().toString(36).slice(2)}`;
  const fields = "format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&fields=id,payload/headers";
  const body =
    ids.map((id, i) => `--${boundary}\r\nContent-Type: application/http\r\nContent-ID: <m${i}>\r\n\r\nGET /gmail/v1/users/me/messages/${id}?${fields}\r\n\r\n`).join("") +
    `--${boundary}--\r\n`;
  const res = await fetch("https://gmail.googleapis.com/batch/gmail/v1", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": `multipart/mixed; boundary=${boundary}` },
    body,
    signal: AbortSignal.timeout(40_000),
  });
  const text = await res.text().catch(() => "");
  const retryable = res.status === 429 || res.status >= 500 || (res.status === 403 && /rate|quota|limit/i.test(text));
  if (!res.ok) {
    if (retryable && attempt < 6) {
      await new Promise((r) => setTimeout(r, Math.min(15_000, 700 * 2 ** attempt) + Math.random() * 400));
      return gmailBatch(token, ids, attempt + 1);
    }
    throw new Error(`gmail batch: HTTP ${res.status}`);
  }
  // Cada parte trae una respuesta HTTP con un JSON; nos quedamos con los 200.
  const out: Msg[] = [];
  let limited = 0;
  for (const part of text.split(/--[^\r\n]+(?:\r?\n|--)/)) {
    const m = part.match(/HTTP\/1\.1 (\d{3})[^\n]*[\s\S]*?(\{[\s\S]*\})\s*$/);
    if (!m) continue;
    if (m[1] === "200") {
      try { out.push(JSON.parse(m[2]) as Msg); } catch { /* parte corrupta: se ignora */ }
    } else if (m[1] === "403" || m[1] === "429") limited += 1;
  }
  // Si Gmail limito muchas partes, reintentar solo las que faltan.
  if (limited > 0 && attempt < 6) {
    const got = new Set(out.map((x) => x.id));
    const missing = ids.filter((id) => !got.has(id));
    await new Promise((r) => setTimeout(r, Math.min(15_000, 700 * 2 ** attempt) + Math.random() * 400));
    return [...out, ...(await gmailBatch(token, missing, attempt + 1))];
  }
  return out;
}

async function listIds(token: string, q: string): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < MAX_PER_QUERY) {
    const params = new URLSearchParams({ q, maxResults: String(PAGE), fields: "messages/id,nextPageToken" });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await gmail<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(token, `messages?${params}`);
    for (const m of data.messages ?? []) ids.push(m.id);
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return ids;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

export async function runMailboxScan(scanId: string, accessToken: string): Promise<void> {
  const supabase = supabaseAdmin();
  const progress = (patch: Record<string, unknown>) => supabase.from("mailbox_scans").update(patch).eq("id", scanId);

  try {
    await progress({ step: "listing" });
    const idSets = await Promise.all(QUERIES.map((q) => listIds(accessToken, q)));
    const ids = [...new Set(idSets.flat())];

    await progress({ step: "headers", messages_seen: 0 });
    const groups = new Map<string, { names: Map<string, number>; kinds: Set<string>; dates: number[]; count: number; sample: string | null; unsub: boolean }>();
    let seen = 0;

    let failed = 0;
    const batches = chunk(ids, BATCH_SIZE);
    await progress({ messages_total: ids.length });
    await mapLimit(batches, CONCURRENCY, async (batchIds) => {
      let msgs: Msg[];
      try {
        msgs = await gmailBatch(accessToken, batchIds);
      } catch (err) {
        failed += batchIds.length;
        if (failed > 300) throw err; // algo va mal de verdad
        return;
      }
      for (const msg of msgs) {
      const h = Object.fromEntries((msg.payload?.headers ?? []).map((x) => [x.name.toLowerCase(), x.value])) as Record<string, string>;
      const from = h.from ? parseFrom(h.from) : null;
      seen += 1;
      if (!from || PERSONAL.has(from.domain) || INFRA.has(from.domain)) continue;

      const g = groups.get(from.domain) ?? { names: new Map<string, number>(), kinds: new Set<string>(), dates: [] as number[], count: 0, sample: null as string | null, unsub: false };
      g.count += 1;
      if (from.name) g.names.set(from.name, (g.names.get(from.name) ?? 0) + 1);
      const t = h.date ? Date.parse(h.date) : NaN;
      if (!Number.isNaN(t)) g.dates.push(t);
      const subject = h.subject ?? "";
      if (ACCOUNT_RE.test(subject)) { g.kinds.add("account"); g.sample ??= subject; }
      else if (RECEIPT_RE.test(subject)) g.kinds.add("receipt");
      if (h["list-unsubscribe"]) g.unsub = true;
      groups.set(from.domain, g);
      }
      await progress({ messages_seen: seen });
    });

    await progress({ step: "grouping", messages_seen: seen });
    const services: MailboxService[] = [...groups.entries()]
      .map(([domain, g]) => {
        const name = [...g.names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || domain;
        const kind: MailboxService["kind"] = g.kinds.has("account") ? "account" : g.kinds.has("receipt") ? "receipt" : g.unsub ? "newsletter" : "other";
        const sorted = g.dates.sort((a, b) => a - b);
        return {
          domain,
          name,
          kind,
          first_seen: sorted.length ? new Date(sorted[0]).toISOString() : null,
          last_seen: sorted.length ? new Date(sorted[sorted.length - 1]).toISOString() : null,
          messages: g.count,
          sample_subject: g.sample ? g.sample.slice(0, 120) : null,
        };
      })
      .filter((s) => s.kind !== "other")
      .sort((a, b) => (b.last_seen ?? "").localeCompare(a.last_seen ?? ""));

    await progress({ status: "done", step: null, messages_seen: seen, services, finished_at: new Date().toISOString() });
    console.log(`[mailbox] escaneo ${scanId}: ${seen} correos (${failed} fallidos), ${services.length} servicios`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[mailbox] escaneo ${scanId} fallo:`, message);
    await progress({ status: "error", error: message.slice(0, 300), finished_at: new Date().toISOString() });
  } finally {
    await revokeToken(accessToken);
  }
}
