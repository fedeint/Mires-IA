import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const d = dirname(fileURLToPath(import.meta.url));
const m = join(d, "..", "migrations", "20260505120000_usuario_presencia_sesiones.sql");
const all = fs.readFileSync(m, "utf8").split("\n");
// A: líneas 66-234 (helpers, RLS, mirest_presence_sesion_iniciar). B: 235-414 (cierre, heartbeat, resto).
const a = all.slice(65, 234).join("\n");
const b = all.slice(234).join("\n");
const outA = { query: a };
const outB = { query: b };
fs.writeFileSync(join(d, "_p2a.arg.json"), JSON.stringify(outA), "utf8");
fs.writeFileSync(join(d, "_p2b.arg.json"), JSON.stringify(outB), "utf8");
console.log(
  "A",
  Buffer.byteLength(JSON.stringify(outA), "utf8"),
  "B",
  Buffer.byteLength(JSON.stringify(outB), "utf8")
);
