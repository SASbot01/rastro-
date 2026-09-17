import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCookies, baseDomain, classifyCookie, summarize, trackerFor } from "../extensions/guardian/lib/analyze.js";

const NOW = 1_800_000_000;
const c = (name, domain, days, extra = {}) => ({ name, domain, expirationDate: days ? NOW + days * 86400 : undefined, session: !days, secure: true, httpOnly: false, ...extra });

test("base domain and tracker lookup", () => {
  assert.equal(baseDomain("www.tienda.com.es"), "tienda.com.es");
  assert.equal(baseDomain(".ads.doubleclick.net"), "doubleclick.net");
  assert.deepEqual(trackerFor("stats.g.doubleclick.net"), { company: "Google", category: "ads" });
  assert.equal(trackerFor("ejemplo.es"), null);
});

test("classifies by name first, then by domain; short prefixes need an exact match", () => {
  assert.equal(classifyCookie(c("_ga_ABC123", ".tienda.es", 400), "tienda.es").category, "analytics");
  assert.equal(classifyCookie(c("_fbp", ".tienda.es", 90), "tienda.es").company, "Meta");
  assert.equal(classifyCookie(c("PHPSESSID", "tienda.es", 0), "tienda.es").category, "necessary");
  assert.equal(classifyCookie(c("frase", "tienda.es", 10), "tienda.es").category, "other"); // no confundir con "fr" de Meta
  assert.equal(classifyCookie(c("xyz", ".criteo.com", 30), "tienda.es").company, "Criteo");
});

test("a clean site scores 100 and says so", () => {
  const r = analyzeCookies({ siteHost: "limpio.es", cookies: [c("PHPSESSID", "limpio.es", 0, { httpOnly: true })], now: NOW });
  assert.equal(r.score, 100);
  assert.equal(r.level, "green");
  assert.match(summarize(r, "es")[0], /casi no te rastrea/);
});

test("ad cookies before consent, brokers and long-lived cookies lower the score and are explained", () => {
  const r = analyzeCookies({
    siteHost: "tienda.es",
    bannerVisible: true,
    now: NOW,
    cookies: [c("PHPSESSID", "tienda.es", 0), c("_ga", ".tienda.es", 730), c("_fbp", ".tienda.es", 90), c("IDE", ".doubleclick.net", 390), c("cto_bundle", ".tienda.es", 395), c("_ttp", ".tienda.es", 390), c("demdex", ".demdex.net", 180), c("_ga", ".tienda.es", 730)],
    thirdPartyHosts: ["connect.facebook.net", "static.criteo.net", "cdn.jsdelivr.net", "rlcdn.com", "tienda.es"],
  });
  assert.equal(r.counts.total, 7, "deduplicates by name+domain");
  assert.ok(r.flags.some((f) => f.code === "before_consent"));
  assert.ok(r.flags.some((f) => f.code === "data_brokers" && f.n === 2));
  assert.ok(r.flags.some((f) => f.code === "long_lived"));
  assert.ok(r.flags.some((f) => f.code === "weak_session"), "PHPSESSID without HttpOnly");
  assert.ok(r.score < 40 && r.level === "red", `score ${r.score}`);
  assert.ok(!r.companies.some((x) => x.company === "jsDelivr"), "CDNs are not trackers");
  const text = summarize(r, "es").join(" ");
  assert.match(text, /antes de que aceptaras/);
  assert.match(text, /comprar y vender perfiles/);
});

test("the report never carries cookie values", () => {
  const r = analyzeCookies({ siteHost: "a.es", cookies: [{ name: "session", domain: "a.es", value: "SECRETO", session: true }], now: NOW });
  assert.ok(!JSON.stringify(r).includes("SECRETO"));
});
