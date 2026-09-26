import { API_SPEC } from "@/lib/api-spec";
import { apiJson, preflight } from "@/lib/api-auth";
export const runtime = "nodejs";
export function OPTIONS() { return preflight(); }
export function GET() { return apiJson(API_SPEC, { headers: { "cache-control": "public, max-age=3600" } }); }
