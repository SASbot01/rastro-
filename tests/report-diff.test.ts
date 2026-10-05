import test from "node:test";
import assert from "node:assert/strict";
import { diffReports, type ReportSnapshot } from "../lib/report/diff-core.ts";

const signals = { knows_employer: false, knows_city: false, contact_data_public: false, false_claims: false };
const hit = (hostname: string, kind = "broker") => ({ url: `https://${hostname}/ana-garcia-ruiz`, hostname, kind });
const snap = (o: { score?: number; breaches?: string[] | null; hits?: ReturnType<typeof hit>[] | null; profiles?: string[] | null; site_checks?: ReportSnapshot["site_checks"] }): ReportSnapshot => ({
  score: o.score ?? 70,
  raw: {
    hibp: o.breaches === null ? { checked: false } : { checked: true, breaches: (o.breaches ?? []).map((n) => ({ name: n, title: n })) },
    brave: o.hits === null ? { ok: false } : { ok: true, hits: o.hits ?? [] },
    ai: o.profiles === null ? undefined : { signals, attributed_profile_urls: o.profiles ?? [] },
  },
  site_checks: o.site_checks,
});
const listed = (slug: string, host: string) => ({ slug, status: "listed", url: `https://${host}/ana-garcia-ruiz` });

test("cambios reales se siguen detectando", () => {
  const d = diffReports(snap({ breaches: ["Adobe"], hits: [hit("spokeo.com")], profiles: ["https://x.com/a"] }), snap({ breaches: ["Adobe", "LinkedIn"], hits: [hit("radaris.com")], profiles: [] }));
  assert.deepEqual([d.new_breaches, d.gone_breaches, d.new_brokers, d.gone_brokers, d.gone_profiles], [["LinkedIn"], [], ["radaris.com"], ["spokeo.com"], ["https://x.com/a"]]);
  assert.equal(d.changed, true);
});

test("una fuente caida este mes no se cuenta como 'ya no apareces'", () => {
  const prev = snap({ score: 40, breaches: ["Adobe", "LinkedIn"], hits: [hit("spokeo.com")], profiles: ["https://x.com/a"] });
  const next = snap({ score: 95, breaches: null, hits: null, profiles: null }); // HIBP caido, buscador con limite, IA en plantilla
  const d = diffReports(prev, next);
  assert.deepEqual([d.gone_breaches, d.gone_brokers, d.gone_profiles], [[], [], []]);
  assert.equal(d.changed, false, "el salto de nota sale de no haber podido mirar, no de la persona");
  // Y al reves: lo que el mes pasado no se pudo mirar no es "nuevo" este mes.
  const back = diffReports(next, prev);
  assert.deepEqual([back.new_breaches, back.new_brokers, back.new_profiles], [[], [], []]);
});

test("el primer informe con comprobacion de sitios no anuncia como nuevos los sitios que antes no se miraban", () => {
  const prev = snap({ hits: [] }); // informe anterior al 19-09: sin site_checks
  const next = snap({ hits: [hit("dateas.com"), hit("infobel.com")], site_checks: [listed("dateas", "dateas.com"), listed("infobel", "infobel.com")] });
  assert.deepEqual(diffReports(prev, next).new_brokers, []);
  // Si el informe anterior SI miro ese sitio y no estaba, entonces si es nuevo.
  const prevChecked = snap({ hits: [], site_checks: [{ slug: "dateas", status: "not_found", url: null }, { slug: "infobel", status: "unknown", url: null }] });
  assert.deepEqual(diffReports(prevChecked, next).new_brokers, ["dateas.com"]);
});

test("un sitio cuya comprobacion fallo este mes no se da por retirado", () => {
  const prev = snap({ hits: [hit("dateas.com"), hit("infobel.com")], site_checks: [listed("dateas", "dateas.com"), listed("infobel", "infobel.com")] });
  const next = snap({ hits: [], site_checks: [{ slug: "dateas", status: "unknown", url: null }, { slug: "infobel", status: "not_found", url: null }] });
  assert.deepEqual(diffReports(prev, next).gone_brokers, ["infobel.com"]);
});
