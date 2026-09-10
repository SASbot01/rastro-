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
const MAX_PER_QUERY = 1000;
const CONCURRENCY = 8;

const QUERIES = [
  // Altas y cuentas
  `subject:(welcome OR bienvenido OR bienvenida OR "verify your" OR verifica OR "confirm your" OR confirma OR "your account" OR "tu cuenta" OR activate OR activa OR "sign up" OR registro OR "new account" OR "nueva cuenta" OR "verification code" OR "código de verificación" OR "reset your password" OR "restablecer" OR contraseña)`,
  // Compras y facturas
  `subject:(receipt OR recibo OR factura OR invoice OR "your order" OR "tu pedido" OR "order confirmation" OR "confirmación de pedido" OR suscripción OR subscription)`,
];

/** Proveedores de correo personal: son personas, no servicios. */
const PERSONAL = new Set(["gmail.com", "googlemail.com", "hotmail.com", "hotmail.es", "outlook.com", "outlook.es", "live.com", "msn.com", "yahoo.com", "yahoo.es", "icloud.com", "me.com", "mac.com", "protonmail.com", "proton.me", "aol.com", "gmx.com", "gmx.es", "telefonica.net", "movistar.es"]);
/** Subdominios de envio que no identifican al servicio. */
const MAIL_SUBS = /^(mail|email|e|em|eml|m|mg|mailer|news|newsletter|noreply|no-reply|notify|notification|notifications|info|hello|hi|support|help|account|accounts|alerts?|updates?|team|contact|marketing|promo|cs|customer|service|info-|send|smtp|bounce|bounces|reply|do-not-reply|donotreply)\./i;
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
  return { name, domain: registrable(host) };
}

async function gmail<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${GMAIL}/${path}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1500));
    return gmail<T>(token, path);
  }
  if (!res.ok) throw new Error(`gmail ${path.split("?")[0]}: HTTP ${res.status}`);
  return (await res.json()) as T;
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

    await mapLimit(ids, CONCURRENCY, async (id) => {
      const msg = await gmail<Msg>(accessToken, `messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe&fields=id,payload/headers`);
      const h = Object.fromEntries((msg.payload?.headers ?? []).map((x) => [x.name.toLowerCase(), x.value])) as Record<string, string>;
      const from = h.from ? parseFrom(h.from) : null;
      seen += 1;
      if (seen % 200 === 0) await progress({ messages_seen: seen });
      if (!from || PERSONAL.has(from.domain)) return;

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
    console.log(`[mailbox] escaneo ${scanId}: ${seen} correos, ${services.length} servicios`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[mailbox] escaneo ${scanId} fallo:`, message);
    await progress({ status: "error", error: message.slice(0, 300), finished_at: new Date().toISOString() });
  } finally {
    await revokeToken(accessToken);
  }
}
