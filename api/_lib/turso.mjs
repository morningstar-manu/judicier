import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let client;
let schemaReady = false;

export function getTurso() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) {
    throw new Error("TURSO_DATABASE_URL manquant — configurez la base Turso.");
  }
  if (!client) {
    client = createClient({ url, authToken });
  }
  return client;
}

export async function ensureSchema() {
  if (schemaReady) return;
  const db = getTurso();
  const sql = readFileSync(
    join(__dirname, "../../database/schema.sqlite.sql"),
    "utf8"
  );
  const cleaned = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  const statements = cleaned
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await db.execute(stmt);
  }
  schemaReady = true;
}
