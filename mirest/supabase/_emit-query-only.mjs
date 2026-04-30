import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
const d = dirname(fileURLToPath(import.meta.url));
const j = JSON.parse(
  fs.readFileSync(join(d, "_mcp-apply-migration-payload.json"), "utf8")
);
fs.writeFileSync(join(d, "_query-only.sql"), j.query, "utf8");
