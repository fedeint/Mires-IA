import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const d = dirname(fileURLToPath(import.meta.url));
const q = fs.readFileSync(join(d, "_query-only.sql"), "utf8");
const o = { name: "usuario_presencia_sesiones", query: q };
fs.writeFileSync(join(d, "mcp-apply-one-line.json"), JSON.stringify(o), "utf8");
console.log("ok", o.query.length);
