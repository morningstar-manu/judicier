#!/usr/bin/env node
/**
 * Crée uniquement le projet GestiPers (Judicier) dans le workspace Plane.so.
 *
 * Prérequis :
 *   export PLANE_API_KEY='...'          # Profile → Personal Access Tokens
 *   export PLANE_WORKSPACE_SLUG='...'   # slug dans https://app.plane.so/<slug>/
 *   # optionnel self-host :
 *   export PLANE_API_BASE='https://api.plane.so'
 *
 * Usage : npm run plane:bootstrap
 */
const API_KEY = process.env.PLANE_API_KEY;
const SLUG = process.env.PLANE_WORKSPACE_SLUG;
const BASE = (process.env.PLANE_API_BASE || "https://api.plane.so").replace(/\/$/, "");

if (!API_KEY || !SLUG) {
  console.error(
    "Manque PLANE_API_KEY et/ou PLANE_WORKSPACE_SLUG.\n" +
      "Crée un PAT dans Plane (Profile → Personal Access Tokens),\n" +
      "puis : export PLANE_API_KEY=... PLANE_WORKSPACE_SLUG=ton-workspace"
  );
  process.exit(1);
}

const headers = {
  "X-API-Key": API_KEY,
  "Content-Type": "application/json",
};

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const PROJECT = {
  name: "GestiPers (Judicier)",
  identifier: "GEST",
  description:
    "Gestion du personnel Présidence RCA — hébergement Proxmox Bangui (gestipers.datapr.org).",
  network: 2,
};

async function main() {
  console.log(`Workspace: ${SLUG}`);
  console.log(`API: ${BASE}`);

  const projects = await api("GET", `/api/v1/workspaces/${SLUG}/projects/`);
  const list = Array.isArray(projects) ? projects : projects?.results || [];
  let project = list.find(
    (p) => p.identifier === PROJECT.identifier || p.name === PROJECT.name
  );

  if (project) {
    console.log(`Déjà présent : ${project.name} (${project.id})`);
  } else {
    project = await api("POST", `/api/v1/workspaces/${SLUG}/projects/`, PROJECT);
    console.log(`Projet créé : ${project.name} (${project.id})`);
  }

  console.log(`https://app.plane.so/${SLUG}/projects/${project.id}/`);
}

main().catch((err) => {
  console.error(err.data || err);
  process.exit(1);
});
