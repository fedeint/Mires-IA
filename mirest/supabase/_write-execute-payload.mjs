import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const d = dirname(fileURLToPath(import.meta.url));
const o = JSON.parse(
  fs.readFileSync(join(d, "mcp-apply-one-line.json"), "utf8")
);
fs.writeFileSync(join(d, "exec-execute-sql-payload.json"), JSON.stringify({ query: o.query }, null, 0), "utf8");
console.log("wrote", o.query.length);
