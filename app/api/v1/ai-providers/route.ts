import { apiJson, authenticate, isIdentity, preflight } from "@/lib/api-auth";
import { AI_PROVIDERS } from "@/lib/ai-providers";
export const runtime = "nodejs";
export function OPTIONS() { return preflight(); }
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!isIdentity(auth)) return auth;
  return apiJson({ providers: Object.values(AI_PROVIDERS) });
}
