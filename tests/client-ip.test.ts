import test from "node:test";
import assert from "node:assert/strict";
import { clientIpFrom } from "../lib/client-ip.ts";

const bag = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

test("detras de Cloudflare manda CF-Connecting-IP: un X-Forwarded-For inventado no cambia la IP", () => {
  // Cloudflare añade la IP real AL FINAL de lo que mande el visitante.
  const a = clientIpFrom(bag({ "x-forwarded-for": "1.1.1.1, 83.44.10.2", "cf-connecting-ip": "83.44.10.2" }), {});
  const b = clientIpFrom(bag({ "x-forwarded-for": "9.9.9.9, 83.44.10.2", "cf-connecting-ip": "83.44.10.2" }), {});
  assert.equal(a, "83.44.10.2");
  assert.equal(a, b);
});

test("en Vercel se ignora CF-Connecting-IP (alli la podria inventar el visitante)", () => {
  assert.equal(clientIpFrom(bag({ "x-forwarded-for": "83.44.10.2", "cf-connecting-ip": "6.6.6.6" }), { VERCEL: "1" }), "83.44.10.2");
});

test("sin proxy: primer X-Forwarded-For, luego X-Real-IP, luego 0.0.0.0", () => {
  assert.equal(clientIpFrom(bag({ "x-forwarded-for": " 10.0.0.5 , 10.0.0.1" }), {}), "10.0.0.5");
  assert.equal(clientIpFrom(bag({ "x-real-ip": "10.0.0.7" }), {}), "10.0.0.7");
  assert.equal(clientIpFrom(bag({}), {}), "0.0.0.0");
});
