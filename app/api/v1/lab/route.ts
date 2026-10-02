import { z } from "zod";
import { apiError, apiJson, authenticate, isIdentity, preflight } from "@/lib/api-auth";
import { canUseLab, jobSummary, labAddCve, labAddFinding, labAddHypothesis, labCreateJob, loadWorkspace, reportLabels, saveWorkspace, toMarkdown } from "@/lib/lab";
import { isLocale, type Locale } from "@/lib/i18n";

/**
 * Rastro Lab por API (v1), para el servidor MCP. Alcance: SOLO el cuaderno de
 * la propia cuenta (nunca de terceros). Pensado para que Claude lleve los
 * reportes de bug bounty: listar/crear trabajos, añadir hallazgos y CVE, y
 * sacar el informe en Markdown. Requiere Pro (o admin), igual que la web.
 */
export const runtime = "nodejs";
export const maxDuration = 30;
export function OPTIONS() { return preflight(); }

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list") }),
  z.object({ action: z.literal("get"), job: z.string().min(1) }),
  z.object({ action: z.literal("report"), job: z.string().min(1) }),
  z.object({ action: z.literal("create_job"), name: z.string().trim().min(1).max(120), host: z.string().trim().max(255).optional(), scope: z.string().trim().max(2000).optional() }),
  z.object({ action: z.literal("add_finding"), job: z.string().min(1), title: z.string().trim().min(1).max(200), where: z.string().trim().max(500).optional(), family: z.string().optional(), severity: z.string().optional(), status: z.string().optional(), notes: z.string().max(8000).optional() }),
  z.object({ action: z.literal("add_cve"), job: z.string().min(1), id: z.string().trim().max(40).optional(), software: z.string().trim().max(120).optional(), version: z.string().trim().max(60).optional(), severity: z.string().optional(), state: z.string().optional(), notes: z.string().max(6000).optional(), ref: z.string().trim().max(500).optional() }),
  z.object({ action: z.literal("add_hypothesis"), job: z.string().min(1), text: z.string().trim().min(1).max(2000), state: z.string().optional() }),
]);

export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!isIdentity(auth)) return auth;
  if (!canUseLab(auth.user)) return apiError(402, "pro_required", "Rastro Lab requiere Pro.");
  const locale: Locale = isLocale(auth.user.locale) ? auth.user.locale : "es";
  const { workspace } = await loadWorkspace(auth.user.id, locale);
  return apiJson({ jobs: Object.entries(workspace.projects).map(([id, p]) => jobSummary(id, p)), active: workspace.active });
}

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (!isIdentity(auth)) return auth;
  if (!canUseLab(auth.user)) return apiError(402, "pro_required", "Rastro Lab requiere Pro.");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_body", "Cuerpo no válido.", { issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) });
  const data = parsed.data;
  const locale: Locale = isLocale(auth.user.locale) ? auth.user.locale : "es";
  const { workspace } = await loadWorkspace(auth.user.id, locale);

  if (data.action === "list") return apiJson({ jobs: Object.entries(workspace.projects).map(([id, p]) => jobSummary(id, p)), active: workspace.active });
  if (data.action === "get") {
    const p = workspace.projects[data.job];
    return p ? apiJson({ id: data.job, ...p }) : apiError(404, "not_found", "Trabajo no encontrado.");
  }
  if (data.action === "report") {
    const p = workspace.projects[data.job];
    return p ? apiJson({ id: data.job, name: p.name, markdown: toMarkdown(p, reportLabels(locale)) }) : apiError(404, "not_found", "Trabajo no encontrado.");
  }

  let jobId: string | null = null; let ok = false;
  if (data.action === "create_job") { jobId = labCreateJob(workspace, locale, data.name, data.host, data.scope); ok = Boolean(jobId); }
  else if (data.action === "add_finding") { ok = labAddFinding(workspace, data.job, data); jobId = data.job; }
  else if (data.action === "add_cve") { ok = labAddCve(workspace, data.job, data); jobId = data.job; }
  else if (data.action === "add_hypothesis") { ok = labAddHypothesis(workspace, data.job, data.text, data.state); jobId = data.job; }
  if (!ok || !jobId) return apiError(422, "not_applied", "No se pudo aplicar (trabajo inexistente o límite alcanzado).");

  const updatedAt = await saveWorkspace(auth.user.id, workspace, locale);
  if (!updatedAt) return apiError(500, "save_failed", "No se pudo guardar.");
  const p = workspace.projects[jobId];
  return apiJson({ ok: true, job: jobSummary(jobId, p), updatedAt });
}
