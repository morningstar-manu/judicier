#!/usr/bin/env node
/**
 * Peuple la base Turso avec le référentiel personnel (database/seed-personnel.json).
 * Idempotent : n'ajoute que les départements/employés absents (identifiés par
 * nom / id) — n'écrase jamais de données déjà présentes dans Turso.
 * Usage : définir TURSO_DATABASE_URL et TURSO_AUTH_TOKEN, puis
 *   npm run seed:personnel
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { loadState, saveState } from "../api/_lib/sync.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const uid = () => Math.random().toString(36).slice(2, 9);

const seed = JSON.parse(
  readFileSync(join(__dirname, "../database/seed-personnel.json"), "utf8")
);

try {
  let state = await loadState();
  if (!state) {
    state = {
      secret: uid() + uid(),
      lang: "fr",
      tp2026: true,
      departments: [],
      users: [],
      employees: [],
      leaves: [],
      attendance: {},
      missions: [],
      prestataires: [],
      visiteurs: [],
      audiences: [],
      evenements: [],
      dossiers: [],
      decrets: [],
      journal: [],
      bagages: [],
    };
  }

  const deptNoms = new Set((state.departments || []).map((d) => d.nom));
  const newDepts = seed.departments.filter((d) => !deptNoms.has(d.nom));

  const empIds = new Set((state.employees || []).map((e) => e.id));
  const newEmployees = seed.employees.filter((e) => !empIds.has(e.id));

  if (newDepts.length === 0 && newEmployees.length === 0) {
    console.log("Rien à faire : le référentiel personnel est déjà présent dans Turso.");
    process.exit(0);
  }

  state.departments = [...(state.departments || []), ...newDepts];
  state.employees = [...(state.employees || []), ...newEmployees];

  await saveState(state);
  console.log(
    `Seed terminé : ${newDepts.length} département(s) et ${newEmployees.length} agent(s) ajoutés dans Turso.`
  );
} catch (err) {
  console.error("Échec du seed personnel:", err.message);
  process.exit(1);
}
