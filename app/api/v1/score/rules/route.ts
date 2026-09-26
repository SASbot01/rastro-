import { apiJson, authenticate, isIdentity, preflight } from "@/lib/api-auth";
export const runtime = "nodejs";
export function OPTIONS() { return preflight(); }
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!isIdentity(auth)) return auth;
  return apiJson({
    start: 100,
    penalties: {
      breachWithPassword: { each: -15, max: -45 },
      breachWithoutPassword: { each: -5, max: -15, note: "Los volcados públicos (pastes) cuentan como filtración sin contraseña." },
      publicProfile: { each: -3, max: -15, note: "Solo perfiles atribuidos a la persona por la IA." },
      aiKnowsEmployer: -10,
      aiKnowsCity: -5,
      contactDataPublic: -15,
      aiFalseData: -5,
    },
    levels: { green: [70, 100], orange: [40, 69], red: [0, 39] },
  });
}
