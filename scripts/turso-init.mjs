#!/usr/bin/env node
/**
 * Initialise le schéma sur une base Turso.
 * Usage : définir TURSO_DATABASE_URL et TURSO_AUTH_TOKEN, puis npm run turso:init
 */
import { ensureSchema } from "../api/_lib/turso.mjs";

try {
  await ensureSchema();
  console.log("Schéma Turso initialisé avec succès.");
} catch (err) {
  console.error("Échec de l'initialisation Turso:", err.message);
  process.exit(1);
}
