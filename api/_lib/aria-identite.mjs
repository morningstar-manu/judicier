/**
 * Client HTTP vers le service Aria Identité (bases ONCA / état civil RCA).
 * Configurez ARIA_IDENTITE_URL (ex. https://aria.example.gov/api) en production.
 */

const BASE = (process.env.ARIA_IDENTITE_URL || "").replace(/\/$/, "");
const API_KEY = process.env.ARIA_IDENTITE_API_KEY || "";
const REQUESTER = process.env.ARIA_REQUESTER_ID || "gestipers";
const LEGAL_BASIS =
  process.env.ARIA_LEGAL_BASIS ||
  "Contrôle d'accès — Présidence de la République Centrafricaine";

export function ariaAvailable() {
  return Boolean(BASE);
}

async function ariaPost(path, body) {
  if (!BASE) {
    return {
      available: false,
      error: "Service Aria Identité non configuré (ARIA_IDENTITE_URL manquant).",
    };
  }
  const headers = { "Content-Type": "application/json" };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        requester_id: REQUESTER,
        legal_basis: LEGAL_BASIS,
        ...body,
      }),
    });
  } catch (err) {
    return { available: false, ok: false, error: `Service Aria Identité injoignable: ${err.message || err}` };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { available: true, ok: false, status: res.status, error: data.error || data.message || `HTTP ${res.status}` };
  }
  return { available: true, ok: true, data };
}

export async function verifyCniOfficial({ doc_number, nom, prenom, date_naissance }) {
  return ariaPost("/verify/cni", { doc_number, nom, prenom, date_naissance });
}

export async function verifyPassportOfficial({ doc_number, nom, prenom, date_naissance }) {
  return ariaPost("/verify/passport", { doc_number, nom, prenom, date_naissance });
}

export async function verifyCivilStatusOfficial({ nom, prenom, date_naissance, lieu_naissance }) {
  return ariaPost("/verify/civil-status", { nom, prenom, date_naissance, lieu_naissance: lieu_naissance || null });
}

export async function verifyOfficialDocument(payload) {
  const type = String(payload.typePiece || "CNI").toUpperCase();
  const base = {
    nom: payload.nom,
    prenom: payload.prenom,
    date_naissance: payload.dateNaissance || payload.date_naissance,
  };

  if (!base.nom || !base.prenom || !base.date_naissance) {
    return {
      available: ariaAvailable(),
      ok: false,
      error: "nom, prenom et dateNaissance requis pour la vérification officielle.",
    };
  }

  if (type.includes("PASS")) {
    if (!payload.numero && !payload.doc_number) {
      return { available: ariaAvailable(), ok: false, error: "numero de passeport requis." };
    }
    return verifyPassportOfficial({
      ...base,
      doc_number: payload.numero || payload.doc_number,
    });
  }

  if (payload.numero || payload.doc_number) {
    return verifyCniOfficial({
      ...base,
      doc_number: payload.numero || payload.doc_number,
    });
  }

  return verifyCivilStatusOfficial({
    ...base,
    lieu_naissance: payload.lieuNaissance || payload.lieu_naissance,
  });
}
