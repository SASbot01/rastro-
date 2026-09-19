import test from "node:test";
import assert from "node:assert/strict";
import { applyCheck, computeRemovalStats, actionableHosts, isPublicHttpUrl, pageListsName, type RemovalLetter } from "../lib/removal-stats.ts";
import { isCronSkipped } from "../lib/demo-accounts.ts";

const FILLER = " Directorio de personas y empresas de España con datos de contacto, dirección postal y teléfono. ".repeat(4);

test("un muro anti-bots o un 'inicia sesion' con 200 OK no es 'ya no aparece'", () => {
  assert.equal(pageListsName(`<html><body><h1>Ana García Ruiz</h1>${FILLER}</body></html>`, "Ana García Ruiz"), true);
  assert.equal(pageListsName(`<html><body><h1>RUIZ GARCIA, ANA</h1>${FILLER}</body></html>`, "Ana García Ruiz"), true);
  assert.equal(pageListsName(`<html><body><h1>Otra persona</h1>${FILLER}</body></html>`, "Ana García Ruiz"), false);
  for (const wall of ["Just a moment... Checking your browser before accessing the site.", "Por favor, completa el CAPTCHA para continuar.", "Acceso denegado. Demasiadas peticiones desde tu red.", "Necesitas activar JavaScript para ver esta página.", "Inicia sesión para ver este perfil."]) {
    assert.equal(pageListsName(`<html><body><p>${wall}</p>${FILLER}</body></html>`, "Ana García Ruiz"), null, wall);
  }
  assert.equal(pageListsName("<html><body>corta</body></html>", "Ana García Ruiz"), null);
  // El nombre dentro de un <script> (datos de la app) no cuenta como ficha visible, y un nombre vacio no se puede comprobar.
  assert.equal(pageListsName(`<script>var u="Ana García Ruiz"</script>${FILLER}`, "Ana García Ruiz"), false);
  assert.equal(pageListsName(FILLER, "  "), null);
});

test("solo se descargan paginas publicas (la URL de una carta de imagen la escribe la persona)", () => {
  for (const ok of ["https://www.dateas.com/es/persona/ana", "http://infobel.com/x", "https://8.8.8.8/x"]) assert.equal(isPublicHttpUrl(ok), true, ok);
  for (const bad of ["http://localhost:54321/rest/v1/users", "http://127.0.0.1:3000/api/health", "http://2130706433/", "http://169.254.169.254/latest/meta-data/", "http://10.0.0.5/", "http://192.168.1.1/", "http://172.20.0.2/", "http://100.114.169.107:3000/", "http://[::1]/", "http://supabase_db_rastro:5432/", "http://nas.local/", "ftp://dateas.com/x", "file:///etc/passwd", "https://user:pass@dateas.com/", "no es una url"]) {
    assert.equal(isPublicHttpUrl(bad), false, bad);
  }
});

test("el aviso de retirada se manda una sola vez aunque la pagina vaya y venga", () => {
  const first = applyCheck({ still_listed: true, removed_at: null, check_count: 1, events: [{ at: "2026-09-01T00:00:00Z", type: "sent" }] }, { listed: false, httpGone: false });
  assert.deepEqual([first.justRemoved, first.notify], [true, true]);
  // Reaparecio y vuelve a desaparecer: se anota otra vez en la cronologia, pero sin otro correo.
  const again = applyCheck({ still_listed: true, removed_at: null, check_count: 5, events: [{ at: "2026-09-08T00:00:00Z", type: "verified_gone" }, { at: "2026-09-15T00:00:00Z", type: "reappeared" }] }, { listed: false, httpGone: false });
  assert.deepEqual([again.justRemoved, again.notify], [true, false]);
});

test("la cuenta demo queda fuera de los crons que actuan sobre datos reales", () => {
  assert.equal(isCronSkipped("Demo@rastropro.com", {}), true);
  assert.equal(isCronSkipped("ana@example.com", {}), false);
  assert.equal(isCronSkipped(null, {}), false);
  assert.equal(isCronSkipped("qa@example.com", { CRON_SKIP_EMAILS: "demo@rastropro.com, qa@example.com" }), true);
  assert.equal(isCronSkipped("demo@rastropro.com", { CRON_SKIP_EMAILS: "" }), false);
});

const L = (o: Partial<RemovalLetter>): RemovalLetter => ({ id: "x", host: "a.com", status: "sent", outcome: null, still_listed: null, removed_at: null, deadline_at: null, ...o });

test("el contador cuenta por sitio y une hallazgos con cartas", () => {
  const now = new Date("2026-09-19T00:00:00Z");
  const s = computeRemovalStats([
    L({ host: "www.a.com", removed_at: "2026-09-10T00:00:00Z" }),
    L({ host: "b.com", deadline_at: "2026-09-01T00:00:00Z" }),
    L({ host: "c.com", deadline_at: "2026-10-01T00:00:00Z" }),
    L({ host: "d.com", outcome: "refused" }),
    L({ host: "e.com", status: "draft" }),
  ], ["a.com", "f.com", "e.com"], now);
  assert.deepEqual(s, { found: 6, requested: 4, removed: 1, pending: 1, overdue: 1, refused: 1, percent: 17 });
});

test("un sitio con dos cartas solo cuenta como retirado si lo estan las dos", () => {
  const s = computeRemovalStats([L({ removed_at: "2026-09-10T00:00:00Z" }), L({})], []);
  assert.equal(s.removed, 0);
  assert.equal(s.pending, 1);
});

test("no se canta victoria en falso: sin haberlo visto antes, no aparecer no es retirada", () => {
  const base = { still_listed: null, removed_at: null, check_count: 0, events: [] };
  assert.equal(applyCheck(base, { listed: false, httpGone: false }).justRemoved, false);
  assert.equal(applyCheck({ ...base, still_listed: true }, { listed: false, httpGone: false }).justRemoved, true);
  assert.equal(applyCheck(base, { listed: false, httpGone: true }).justRemoved, true);
});

test("un fallo de lectura no pisa el resultado anterior y una reaparicion reabre", () => {
  const seen = { still_listed: true, removed_at: null, check_count: 2, events: [] };
  const unknown = applyCheck(seen, { listed: null, httpGone: false });
  assert.equal("still_listed" in unknown.patch, false);
  assert.equal(unknown.patch.check_count, 3);
  const back = applyCheck({ ...seen, still_listed: false, removed_at: "2026-09-01T00:00:00Z" }, { listed: true, httpGone: false });
  assert.equal(back.reappeared, true);
  assert.equal(back.patch.removed_at, null);
});

test("las filtraciones no son sitios a los que pedir retirada", () => {
  assert.deepEqual(actionableHosts([{ category: "breaches", source_url: "https://x.com/a" }, { category: "profiles", source_url: "https://www.y.com/p" }, { category: "ai", source_url: null }]), ["y.com"]);
});
