// Copia el robot de la extension a la web (demo en /extension) y empaqueta la extension en public/extension/rastro-guardian.zip.
import { cpSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
mkdirSync("public/extension", { recursive: true });
cpSync("extensions/guardian/mascot.js", "public/extension/mascot.js");
const zip = "public/extension/rastro-guardian.zip";
if (existsSync(zip)) rmSync(zip);
execFileSync("zip", ["-r", "-q", `../../${zip}`, ".", "-x", "README.md"], { cwd: "extensions/guardian" });
console.log("extension sincronizada:", zip);
