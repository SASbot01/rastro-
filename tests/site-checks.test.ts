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

test("los apellidos con particulas ('de la', 'de los', 'del') tambien se reconocen", () => {
  assert.equal(mentionsName("Juan de la Cruz - Madrid | Dateas", "Juan de la Cruz"), true);
  assert.equal(mentionsName("José Luis de la Fuente Pérez, administrador único", "José Luis de la Fuente Pérez"), true);
  assert.equal(mentionsName("DE LOS SANTOS GIL, MARIA", "María de los Santos Gil"), true);
  assert.equal(mentionsName("María del Carmen López", "María del Carmen López"), true);
  // Sigue sin juntar trozos de personas distintas.
  assert.equal(mentionsName("Juan Pérez trabaja en Cruz y asociados desde 2019", "Juan de la Cruz"), false);
  assert.equal(mentionsName("Ana García López, socia de Ruiz y asociados", "Ana García Ruiz"), false);
});
