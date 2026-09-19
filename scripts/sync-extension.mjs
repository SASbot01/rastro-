// Copia el robot de la extension a la web (demo en /extension) y empaqueta la extension en public/extension/rastro-guardian.zip.
import { cpSync, mkdirSync, existsSync, rmSync, writeFileSync } from "node:fs";
import { blockedDomains } from "../extensions/guardian/lib/trackers.js";
import { execFileSync } from "node:child_process";
mkdirSync("public/extension", { recursive: true });

// Reglas de bloqueo (declarativeNetRequest) a partir de la misma lista que usa el resumen: solo publicidad y
// comercio de datos, solo como tercero. Medicion y redes sociales no se bloquean (rompen inicios de sesion y videos).
const blocked = blockedDomains();
const rules = blocked.map((domain, i) => ({ id: i + 1, priority: 1, action: { type: "block" }, condition: { requestDomains: [domain], domainType: "thirdParty", resourceTypes: ["script", "xmlhttprequest", "image", "sub_frame", "ping", "other"] } }));
mkdirSync("extensions/guardian/rules", { recursive: true });
writeFileSync("extensions/guardian/rules/trackers.json", JSON.stringify(rules, null, 1) + "\n");
console.log("reglas de bloqueo:", rules.length);
cpSync("extensions/guardian/mascot.js", "public/extension/mascot.js");
const zip = "public/extension/rastro-guardian.zip";
if (existsSync(zip)) rmSync(zip);
execFileSync("zip", ["-r", "-q", `../../${zip}`, ".", "-x", "README.md"], { cwd: "extensions/guardian" });
console.log("extension sincronizada:", zip);
