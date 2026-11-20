#!/usr/bin/env node
/**
 * Crée le projet Judicier/GestiPers dans Plane.so + work items de migration Proxmox.
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
    "Migration et exploitation de GestiPers (Judicier) hors Vercel vers le cluster Proxmox Bangui (VM gestipers .186, Traefik, Cloudflare).",
  network: 2,
};

const ISSUES = [
  {
    name: "Terraform : créer la VM gestipers (.186)",
    description:
      "Ajouter gestipers dans terraform/vms.tf (pve-web, vm_id 186, 2 vCPU, 2 Go). `terraform plan` doit montrer 1 add / 0 destroy, puis apply.",
  },
  {
    name: "Ansible : provisionner la VM (app-hosts)",
    description:
      "Ajouter gestipers dans inventory.ini [apps], ping, puis ansible-playbook app-hosts.yml. Vérifier SSH runner → VM + docker.",
  },
  {
    name: "Secrets runtime sur la VM",
    description:
      "Créer /opt/app/.env.secrets avec TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, GESTIPERS_API_SECRET (et ARIA_* si besoin) — valeurs depuis Vercel / Vault. Ne jamais committer.",
  },
  {
    name: "Miroir Infra-Bangui/gestipers + premier build GHCR",
    description:
      "Synchroniser morningstar-manu/judicier → Infra-Bangui/gestipers, push workflow deploy, image ghcr.io/infra-bangui/gestipers. Environnement GitHub production avec reviewers.",
  },
  {
    name: "Traefik : route gestipers.datapr.org",
    description:
      "Déployer ansible/roles/traefik/files/gestipers.yml via traefik-proxy01.yml. curl -H Host:gestipers.datapr.org → 200.",
  },
  {
    name: "Cloudflare Tunnel bangui-web",
    description:
      "Public Hostname gestipers.datapr.org → HTTP localhost:80 sur le tunnel bangui-web.",
  },
  {
    name: "Supervision Prometheus / Grafana",
    description: "ansible-playbook monitoring-only.yml — VM gestipers UP sur mon01.",
  },
  {
    name: "Basculer DNS gestipers.org (optionnel)",
    description:
      "Quand Bangui est stable : pointer www.gestipers.org / gestipers.org vers le tunnel, puis désactiver le projet Vercel judicier.",
  },
  {
    name: "Commit infra-bangui",
    description:
      "Committer vms.tf, inventory, route Traefik sur morningstar-manu/infra-bangui après validation bout-en-bout.",
  },
];

async function main() {
  console.log(`Workspace: ${SLUG}`);
  console.log(`API: ${BASE}`);

  let projects = await api("GET", `/api/v1/workspaces/${SLUG}/projects/`);
  const list = Array.isArray(projects) ? projects : projects?.results || [];
  let project = list.find(
    (p) => p.identifier === PROJECT.identifier || p.name === PROJECT.name
  );

  if (project) {
    console.log(`Projet existant : ${project.name} (${project.id})`);
  } else {
    project = await api("POST", `/api/v1/workspaces/${SLUG}/projects/`, PROJECT);
    console.log(`Projet créé : ${project.name} (${project.id})`);
  }

  const projectId = project.id;
  let existing = [];
  try {
    const issues = await api(
      "GET",
      `/api/v1/workspaces/${SLUG}/projects/${projectId}/issues/`
    );
    existing = Array.isArray(issues) ? issues : issues?.results || [];
  } catch (e) {
    // v1 issues endpoint naming can vary; try work-items
    try {
      const wi = await api(
        "GET",
        `/api/v1/workspaces/${SLUG}/projects/${projectId}/work-items/`
      );
      existing = Array.isArray(wi) ? wi : wi?.results || [];
    } catch {
      console.warn("Impossible de lister les issues existantes:", e.message);
    }
  }

  const existingNames = new Set(existing.map((i) => i.name || i.payload?.name));

  for (const issue of ISSUES) {
    if (existingNames.has(issue.name)) {
      console.log(`  skip (existe) : ${issue.name}`);
      continue;
    }
    const body = { name: issue.name, description_html: `<p>${issue.description}</p>` };
    try {
      await api(
        "POST",
        `/api/v1/workspaces/${SLUG}/projects/${projectId}/issues/`,
        body
      );
      console.log(`  + issue : ${issue.name}`);
    } catch (e) {
      try {
        await api(
          "POST",
          `/api/v1/workspaces/${SLUG}/projects/${projectId}/work-items/`,
          body
        );
        console.log(`  + work-item : ${issue.name}`);
      } catch (e2) {
        console.error(`  ! échec ${issue.name}:`, e2.status, e2.data || e2.message);
      }
    }
  }

  console.log(
    `\nOuvre : https://app.plane.so/${SLUG}/projects/${projectId}/issues/`
  );
}

main().catch((err) => {
  console.error(err.data || err);
  process.exit(1);
});
