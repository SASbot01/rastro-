import test from "node:test";
import assert from "node:assert/strict";
import { buildSiteQueries, mentionsName, resolveGroup } from "../lib/site-checks-core.ts";

const T = [{ slug: "dateas", name: "Dateas", hosts: ["dateas.com"] }, { slug: "axesor", name: "Axesor", hosts: ["axesor.es", "axesor.com"] }, { slug: "infobel", name: "Infobel", hosts: ["infobel.com"] }];

test("las consultas agrupan sitios para gastar pocas busquedas", () => {
  const q = buildSiteQueries("Ana García Ruiz", T, 2);
  assert.equal(q.length, 2);
  assert.equal(q[0].query, '"Ana García Ruiz" (site:dateas.com OR site:axesor.es)');
});

test("solo cuenta si el resultado es del sitio y nombra a la persona entera", () => {
  const hits = [
    { title: "Ana Garcia Ruiz - Valencia | Dateas", url: "https://www.dateas.com/es/persona/ana-garcia-ruiz-1", hostname: "www.dateas.com", snippet: "" },
    { title: "Ana García López, administradora", url: "https://www.axesor.es/x", hostname: "www.axesor.es", snippet: "Ruiz y asociados" },
    { title: "Ana García Ruiz", url: "https://otra.com/x", hostname: "otra.com", snippet: "" },
  ];
  const r = resolveGroup("Ana García Ruiz", T, hits);
  assert.deepEqual(r.map((c) => [c.slug, c.status]), [["dateas", "listed"], ["axesor", "not_found"], ["infobel", "not_found"]]);
});

test("homonimo parcial no cuenta y una busqueda fallida es 'no se pudo comprobar'", () => {
  assert.equal(mentionsName("Ana García, enfermera en Valencia", "Ana García Ruiz"), false);
  assert.equal(mentionsName("RUIZ GARCIA, ANA", "Ana García Ruiz"), true);
  assert.deepEqual(resolveGroup("Ana García Ruiz", T, null).map((c) => c.status), ["unknown", "unknown", "unknown"]);
});
