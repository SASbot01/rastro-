import test from "node:test";
import assert from "node:assert/strict";
import { buildReconCommand, hostInScope, parseNmapServices, validHost } from "../mcp/runner-core.mjs";

test("solo construye herramientas de la lista blanca", () => {
  assert.ok(buildReconCommand({ tool: "exploit", host: "10.10.10.3", scope: "10.10.*" }).error);
  const r = buildReconCommand({ tool: "nmap_fast", host: "10.10.10.3", scope: "10.10.*" });
  assert.deepEqual([r.bin, r.args.includes("10.10.10.3")], ["nmap", true]);
});
test("el host se ata como argumento: nada de inyección", () => {
  assert.equal(validHost("10.10.10.3; rm -rf ~"), false);
  assert.equal(validHost("$(curl evil)"), false);
  assert.ok(buildReconCommand({ tool: "nmap_fast", host: "a.htb && id", scope: "*.htb" }).error);
});
test("candado de alcance: sin alcance no se ejecuta; fuera de alcance se rechaza", () => {
  assert.equal(hostInScope("10.10.10.3", ""), false);
  assert.equal(hostInScope("8.8.8.8", "10.10.*,*.htb"), false);
  assert.equal(hostInScope("10.10.10.3", "10.10.*"), true);
  assert.equal(hostInScope("research.bedside.htb", "*.htb"), true);
  assert.ok(buildReconCommand({ tool: "nmap_fast", host: "8.8.8.8", scope: "10.10.*,*.htb" }).error);
});
test("parsea servicios de nmap", () => {
  const sv = parseNmapServices("22/tcp open ssh OpenSSH 10.0p2\n80/tcp open http Apache 2.4.68\n3000/tcp filtered ppp");
  assert.deepEqual(sv.map((s) => [s.port, s.name]), [[22, "ssh"], [80, "http"]]);
});
