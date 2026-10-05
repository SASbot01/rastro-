import { z } from "zod";
import { apiError, apiJson, authenticate, isIdentity, preflight } from "@/lib/api-auth";
import { computeScore, levelFor } from "@/lib/report/score";
export const runtime = "nodejs";
export function OPTIONS() { return preflight(); }
const schema = z.object({
  breachesWithPassword: z.number().int().min(0).max(1000).default(0),
  breachesWithoutPassword: z.number().int().min(0).max(1000).default(0),
  publicProfiles: z.number().int().min(0).max(1000).default(0),
  aiKnowsEmployer: z.boolean().default(false),
  aiKnowsCity: z.boolean().default(false),
  contactDataPublic: z.boolean().default(false),
  aiFalseData: z.boolean().default(false),
});
export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!isIdentity(auth)) return auth;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_body", "Cuerpo no válido.", { issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  const { score, breakdown } = computeScore(parsed.data);
  return apiJson({ score, level: levelFor(score), breakdown });
}
