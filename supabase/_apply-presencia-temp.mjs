import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const p = join(__dirname, "migrations", "20260505120000_usuario_presencia_sesiones.sql");
const q = fs.readFileSync(p, "utf8");
const payload = {
  name: "usuario_presencia_sesiones",
  query: q,
};
fs.writeFileSync(join(__dirname, "_mcp-apply-migration-payload.json"), JSON.stringify(payload), "utf8");
console.log("written", payload.query.length, "bytes");
