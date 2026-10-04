import test from "node:test";
import assert from "node:assert/strict";
import { playbookFor, playbookSteps, productFromVersion } from "../lib/lab-playbooks-core.ts";

test("encuentra la guía por nombre o por puerto y rellena el host", () => {
  assert.equal(playbookFor({ name: "http" }).service, "http");
  assert.equal(playbookFor({ port: 445 }).service, "smb");
  assert.equal(playbookFor({ name: "nada", port: 9999 }), null);
  const steps = playbookSteps({ name: "http", port: 8080, host: "10.10.10.5" });
  assert.ok(steps.length >= 3);
  assert.ok(steps[0].cmd.includes("10.10.10.5:8080"));
});
test("el host sucio no se cuela en el comando", () => {
  const steps = playbookSteps({ name: "smb", host: "10.10.10.5; rm -rf ~" });
  assert.ok(steps.every((s) => !s.cmd.includes("rm -rf") || s.cmd.includes("<host>")));
  assert.ok(steps[0].cmd.includes("<host>"));
});
test("saca producto y versión del banner para buscar CVEs", () => {
  assert.deepEqual(productFromVersion("Apache httpd 2.4.68"), { product: "Apache httpd", version: "2.4.68" });
  assert.deepEqual(productFromVersion("OpenSSH 10.0p2 Debian"), { product: "OpenSSH", version: "10.0p2" });
  assert.equal(productFromVersion("algo sin version").version, null);
});
