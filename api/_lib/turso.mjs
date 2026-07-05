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
  const migrations = [
    "ALTER TABLE audiences ADD COLUMN piece_fichier_id TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE audiences ADD COLUMN piece_nom_fichier TEXT NOT NULL DEFAULT ''",
    `CREATE TABLE IF NOT EXISTS controles_bagages (
      client_id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL DEFAULT '',
      agent_nom TEXT NOT NULL DEFAULT '',
      visiteur_id TEXT NOT NULL DEFAULT '',
      lieu TEXT NOT NULL DEFAULT '',
      date_controle TEXT NOT NULL,
      type_objet TEXT NOT NULL DEFAULT 'Bagage',
      statut TEXT NOT NULL DEFAULT 'Conforme',
      photo_id TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      cree_le TEXT DEFAULT (datetime('now'))
    )`,
    "CREATE INDEX IF NOT EXISTS idx_bagages_date ON controles_bagages(date_controle)",
  ];
  for (const stmt of migrations) {
    try { await db.execute(stmt); } catch { /* colonne déjà présente */ }
  }
  schemaReady = true;
}
