import { z } from "zod";
import { apiError, apiJson, authenticate, isIdentity, preflight } from "@/lib/api-auth";
import { buildLetter } from "@/lib/letters";
import { brokerForHost } from "@/lib/brokers/catalog";
import { LOCALES } from "@/lib/i18n";
export const runtime = "nodejs";
export function OPTIONS() { return preflight(); }
const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.email(),
  city: z.string().trim().max(120).optional(),
  url: z.url(),
  what: z.string().trim().max(300).optional(),
  locale: z.enum(LOCALES).default("es"),
});
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!isIdentity(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_body", "Cuerpo no válido.", { issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  const d = parsed.data;
  let host: string;
  try { host = new URL(d.url).hostname.replace(/^www\./, ""); } catch { return apiError(400, "invalid_url", "URL no válida."); }
  const known = brokerForHost(host);
  const what = d.what ?? (d.locale === "es" ? "datos personales que me identifican" : "personal data that identifies me");
  const letter = buildLetter({ fullName: d.fullName, email: d.email, city: d.city ?? null, host, url: d.url, what, locale: d.locale });
  return apiJson({ host, subject: letter.subject, body: letter.body, contact: known?.email ?? known?.optOutUrl ?? null, known: known ? { slug: known.slug, name: known.name, steps: known.steps, typicalDays: known.typicalDays } : null, legal_basis: ["GDPR art. 17", "GDPR art. 21", "GDPR art. 12.3"] });
}
