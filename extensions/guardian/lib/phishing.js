// Motor puro de deteccion de webs que imitan a otras. Todo se calcula con el nombre del dominio
// y dos señales de la pagina (¿pide contraseña?, ¿pide tarjeta?). Sin red, sin listas remotas.
import { baseDomain } from "./analyze.js";
import { BAIT_WORDS, BRANDS, NOT_TYPOS, RISKY_TLDS } from "./brands.js";

const CONFUSABLES = [[/0/g, "o"], [/1/g, "l"], [/3/g, "e"], [/4/g, "a"], [/5/g, "s"], [/7/g, "t"], [/8/g, "b"], [/\$/g, "s"], [/rn/g, "m"], [/vv/g, "w"], [/cl/g, "d"]];
// Letras de otros alfabetos que se ven igual que una latina (cirilico y griego mas usados en ataques).
const HOMOGLYPHS = { "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "ɡ": "g", "ո": "n", "ս": "u", "ν": "v", "ο": "o", "α": "a", "ρ": "p", "τ": "t", "κ": "k", "ı": "i", "ł": "l" };

/** Punycode (RFC 3492) -> texto, para ver las letras reales de un dominio xn--. */
export function decodePunycode(label) {
  if (!label.startsWith("xn--")) return label;
  const input = label.slice(4);
  const out = [];
  const d = input.lastIndexOf("-");
  for (let j = 0; j < Math.max(d, 0); j++) out.push(input.charCodeAt(j));
  let n = 128, i = 0, bias = 72;
  for (let idx = d > 0 ? d + 1 : 0; idx < input.length; ) {
    const old = i;
    for (let w = 1, k = 36; ; k += 36) {
      if (idx >= input.length) return label;
      const c = input.charCodeAt(idx++);
      const digit = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : 36;
      if (digit >= 36) return label;
      i += digit * w;
      const t = k <= bias ? 1 : k >= bias + 26 ? 26 : k - bias;
      if (digit < t) break;
      w *= 36 - t;
    }
    const len = out.length + 1;
    let delta = old === 0 ? Math.floor((i - old) / 700) : (i - old) >> 1;
    delta += Math.floor(delta / len);
    let k2 = 0;
    while (delta > 455) { delta = Math.floor(delta / 35); k2 += 36; }
    bias = k2 + Math.floor((36 * delta) / (delta + 38));
    n += Math.floor(i / len);
    i %= len;
    out.splice(i++, 0, n);
  }
  try { return String.fromCodePoint(...out); } catch { return label; }
}

function deconfuse(label) {
  let s = label.toLowerCase();
  s = Array.from(s).map((ch) => HOMOGLYPHS[ch] || ch).join("");
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const [re, to] of CONFUSABLES) s = s.replace(re, to);
  return s;
}

export function levenshtein(a, b, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prevPrev[j - 2] + 1); // letras cambiadas de sitio
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    var prevPrev = prev; // eslint-disable-line no-var
    prev = cur;
  }
  return prev[b.length];
}

function isOfficial(base, brand) { return brand[2].some((d) => base === d || base.endsWith("." + d)); }
const ALL_OFFICIAL = new Set(BRANDS.flatMap((b) => b[2]));
const IP = /^(\d{1,3}\.){3}\d{1,3}$|^\[[0-9a-f:]+\]$/i;

/**
 * @param {{host: string, https?: boolean, hasPassword?: boolean, hasCard?: boolean}} input
 * @returns {{level: "none"|"suspicious"|"danger", reasons: string[], brand: null|{key:string,name:string,official:string,url:string}}}
 */
export function assessSite(input) {
  const host = String(input.host || "").toLowerCase().replace(/\.$/, "");
  const out = { level: "none", reasons: [], brand: null };
  if (!host || host === "localhost" || host.endsWith(".local")) return out;
  const asks = Boolean(input.hasPassword || input.hasCard);

  if (IP.test(host)) {
    if (asks && !/^(10\.|192\.168\.|127\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) { out.level = "suspicious"; out.reasons.push("ip_login"); }
    return out;
  }

  const base = baseDomain(host);
  if (ALL_OFFICIAL.has(base)) {
    if (asks && input.https === false) { out.level = "suspicious"; out.reasons.push("no_https_login"); }
    return out;
  }
  const labels = host.split(".");
  const tld = labels[labels.length - 1];
  const baseLabel = decodePunycode(base.split(".")[0]);
  const tokens = labels.map(decodePunycode).join(".").split(/[.\-_]/).filter(Boolean);
  const plainTokens = tokens.map(deconfuse);
  const risky = RISKY_TLDS.includes(tld);
  const bait = tokens.some((tk) => BAIT_WORDS.includes(tk)) || plainTokens.some((tk) => BAIT_WORDS.includes(tk));
  const puny = labels.some((l) => l.startsWith("xn--")) || /[^\x00-\x7f]/.test(host);
  const plainBase = deconfuse(baseLabel);
  const compactBase = plainBase.replace(/[^a-z0-9]/g, "");
  const rawBase = baseLabel.replace(/[^a-z0-9]/g, "");

  let hit = null, strength = 0; // 3 = imitacion clara, 2 = marca + cebo, 1 = indicio
  for (const brand of BRANDS) {
    const rawKey = brand[0];
    const key = deconfuse(rawKey); // la marca pasa por el mismo filtro que el dominio ("icloud" -> "idoud") para poder compararlas
    if (isOfficial(base, brand)) return out;
    // La marca a secas con otra extension de pais (amazon.nl, bbva.pt) casi siempre es suya: solo se duda si la extension es de las baratas.
    if (rawBase === rawKey && !risky && !puny) return out;
    // a) El dominio base ES el nombre de la marca tras deshacer trucos (paypa1, аmazon, rnicrosoft) o con otra extension rara.
    if (compactBase === key && (rawBase !== rawKey || puny || risky)) { hit = brand; strength = 3; out.reasons.push(puny ? "homograph" : "lookalike"); break; }
    // b) A una o dos letras de la marca (santader, caixabnak). Solo marcas largas y misma inicial: menos falsos positivos.
    //    Palabras y empresas reales que caen a una letra (revolt.tv, amazone.de, correo.*) quedan fuera, y a DOS letras
    //    hace falta otra señal: si no, bannister.com "imitaba" a Bankinter y microvolt.com a Microsoft.
    if (key.length >= 6 && compactBase[0] === key[0] && compactBase !== key && !NOT_TYPOS.has(rawBase)) {
      const d = levenshtein(compactBase, key, 2);
      if (d === 1 || (d === 2 && key.length >= 9 && (risky || bait || puny))) { hit = brand; strength = 3; out.reasons.push("typo"); break; }
    }
    // b2) La marca mal escrita como palabra suelta junto a un cebo o una extension barata (santader-clientes.com, caixabnak-acceso.top).
    if (key.length >= 6 && (bait || risky)) {
      const near = plainBase.split(/[^a-z0-9]+/).find((tk) => tk && tk !== plainBase && tk[0] === key[0] && tk !== key && !NOT_TYPOS.has(tk) && (() => { const d = levenshtein(tk, key, 2); return d === 1 || (d === 2 && key.length >= 9); })());
      if (near) { hit = brand; strength = 3; out.reasons.push("typo"); break; }
    }
    // c) La marca aparece como palabra en un dominio que no es suyo (bbva-clientes.com, correos.paquete-info.top).
    const asToken = tokens.includes(rawKey) || plainTokens.includes(key) || (key.length >= 6 && compactBase.startsWith(key) && compactBase.length > key.length && BAIT_WORDS.some((w) => compactBase.slice(key.length) === w));
    if (asToken && strength < 2) {
      // Que pida contraseña no basta (apple-pie.com con login es legitima): hace falta una palabra cebo o una extension de las baratas.
      const s = (bait ? 1 : 0) + (risky ? 1 : 0);
      if (s >= 1) { hit = brand; strength = s >= 2 ? 3 : 2; }
    }
  }

  if (hit) {
    out.brand = { key: hit[0], name: hit[1], official: hit[2][0], url: hit[3] };
    if (!out.reasons.length) out.reasons.push("brand_in_domain");
    if (risky) out.reasons.push("risky_tld");
    if (asks) out.reasons.push(input.hasCard ? "asks_card" : "asks_password");
    out.level = strength >= 3 || asks ? "danger" : "suspicious";
    return out;
  }

  // Sin marca: solo señales fuertes combinadas, y siempre como "sospechosa", nunca "peligro".
  // Un dominio con ñ o tildes (logroño.es, españa.es) es normal: solo cuentan las letras de OTRO alfabeto (cirilico, griego...).
  const foreignScript = /[^ -ɏ]/.test(labels.map(decodePunycode).join("."));
  if (foreignScript && asks) { out.level = "suspicious"; out.reasons.push("homograph", "asks_password"); return out; }
  if (asks && input.https === false) { out.level = "suspicious"; out.reasons.push("no_https_login"); return out; }
  if (asks && risky && (bait || labels.length >= 4 || (host.match(/-/g) || []).length >= 3)) { out.level = "suspicious"; out.reasons.push("risky_tld", input.hasCard ? "asks_card" : "asks_password"); }
  return out;
}

const TEXT = {
  es: {
    danger: (b) => `Cuidado: esta web imita a ${b}.`,
    suspicious_brand: (b) => `Esta web usa el nombre de ${b} pero no es su dominio oficial.`,
    suspicious: () => "Esta web tiene señales de no ser de fiar.",
    official: (d) => `La web oficial es ${d}. Esta es otra.`,
    lookalike: "El nombre del dominio está escrito para parecerse al original.",
    typo: "El dominio está a una letra del original: es el truco más común.",
    homograph: "Usa letras de otro alfabeto que se ven iguales a las normales.",
    brand_in_domain: "Poner la marca delante de otro dominio es un truco habitual de estafa.",
    risky_tld: "Termina en una extensión barata muy usada en fraudes.",
    asks_password: "Te está pidiendo una contraseña. No la escribas aquí.",
    asks_card: "Te está pidiendo una tarjeta. No la escribas aquí.",
    no_https_login: "Pide datos sin conexión cifrada: cualquiera en la red podría leerlos.",
    ip_login: "Pide datos desde una dirección numérica, sin nombre de dominio.",
  },
  en: {
    danger: (b) => `Careful: this site imitates ${b}.`,
    suspicious_brand: (b) => `This site uses the ${b} name but is not its official domain.`,
    suspicious: () => "This site shows signs of not being trustworthy.",
    official: (d) => `The official site is ${d}. This is a different one.`,
    lookalike: "The domain name is written to look like the original.",
    typo: "The domain is one letter away from the original: the most common trick.",
    homograph: "It uses letters from another alphabet that look like normal ones.",
    brand_in_domain: "Putting the brand in front of another domain is a common scam trick.",
    risky_tld: "It ends in a cheap extension widely used in fraud.",
    asks_password: "It is asking for a password. Don't type it here.",
    asks_card: "It is asking for a card. Don't type it here.",
    no_https_login: "It asks for data without an encrypted connection: anyone on the network could read it.",
    ip_login: "It asks for data from a numeric address with no domain name.",
  },
};

/** Frases llanas para la burbuja. */
export function describeRisk(risk, locale) {
  const t = TEXT[locale === "en" ? "en" : "es"];
  if (risk.level === "none") return { title: "", lines: [] };
  const title = risk.brand ? (risk.level === "danger" ? t.danger(risk.brand.name) : t.suspicious_brand(risk.brand.name)) : t.suspicious();
  const lines = [];
  if (risk.brand) lines.push(t.official(risk.brand.official));
  for (const r of risk.reasons) if (typeof t[r] === "string") lines.push(t[r]);
  return { title, lines: lines.slice(0, 4) };
}
