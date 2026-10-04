import assert from "node:assert/strict";

const base = process.env.RASTRO_SMOKE_URL ?? "http://127.0.0.1:3000";
const screens = ["report", "dashboard", "letter", "profile", "team", "guardian", "system"];
let checked = 0;
for (const locale of ["es", "en"]) {
  const headers = { cookie: `rastro_locale=${locale}; rastro_theme=light` };
  for (const screen of screens) {
    const response = await fetch(`${base}/demo?screen=${screen}`, { headers });
    assert.equal(response.status, 200, `${locale}/${screen}`);
    const html = await response.text();
    assert.ok(html.includes(`lang="${locale}"`), `locale ${screen}`);
    assert.ok(html.includes('data-theme="light"'), `SSR theme ${screen}`);
    assert.ok(html.includes(locale === "es" ? "DATOS FICTICIOS" : "FICTIONAL DATA"), `demo marker ${screen}`);
    assert.ok(html.includes('noindex'), `private demo metadata ${screen}`);
    checked++;
  }
  for (const path of ["/", "/guardian", "/ayuda-urgente", "/simulador", "/herramientas", "/informe"]) {
    const response = await fetch(`${base}${path}`, { headers });
    assert.equal(response.status, 200, `${locale}${path}`); checked++;
  }
  const manifest = await (await fetch(`${base}/manifest.webmanifest`, { headers })).json();
  assert.ok(manifest.shortcuts.some((s) => s.url === "/ayuda-urgente")); checked++;
}
const reportId = "00000000-0000-4000-8000-000000000000";
const status = await fetch(`${base}/api/report/${reportId}`);
assert.equal(status.status, 404);
assert.deepEqual(await status.json(), { status: "not_found" });
assert.match(status.headers.get("cache-control"), /no-store/); checked++;
assert.equal((await fetch(`${base}/api/org/export`)).status, 401); checked++;
const privatePage = await fetch(`${base}/informe/${reportId}`);
assert.equal(privatePage.status, 200);
assert.ok((await privatePage.text()).includes('href="/entrar"')); checked++;
console.log(`PASS: ${checked} HTTP checks, ES/EN, all demo screens, theme, private access and PWA.`);
