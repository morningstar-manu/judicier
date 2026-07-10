import { parse } from "mrz";

/** Extrait les lignes MRZ (TD1/TD3) d'un texte OCR brut. */
export function extractMrzLines(text) {
  const raw = String(text || "")
    .toUpperCase()
    .split(/\r?\n/)
    .map((l) => l.replace(/\s/g, ""))
    .filter((l) => l.length >= 20 && /^[A-Z0-9<]+$/.test(l));

  const pad = (l, len) => (l.length >= len ? l.slice(0, len) : l.padEnd(len, "<"));

  const td3 = raw.filter((l) => l.startsWith("P<") || l.length >= 40).map((l) => pad(l, 44));
  if (td3.length >= 2) return td3.slice(-2);

  const td1 = raw.filter((l) => l.length >= 26).map((l) => pad(l, 30));
  if (td1.length >= 3) return td1.slice(-3);

  return raw.slice(-2).map((l) => pad(l, 44));
}

/** Parse MRZ → champs structurés (passeport / CNI). */
export function parseMrzFromText(text) {
  const lines = extractMrzLines(text);
  if (lines.length < 2) {
    return { ok: false, msg: "Aucune zone MRZ détectée dans le texte.", lines: [] };
  }
  try {
    const result = parse(lines);
    const fields = result.fields || {};
    const nom = (fields.lastName || "").replace(/</g, " ").trim();
    const prenom = (fields.firstName || "").replace(/</g, " ").trim();
    const docNumber = (fields.documentNumber || fields.optional1 || "").replace(/</g, "").trim();
    const birth = fields.birthDate || "";
    const expiry = fields.expirationDate || "";
    const nationality = fields.nationality || "";
    const sex = fields.sex || "";
    const typePiece = result.format === "TD1" ? "CNI" : "Passeport";

    return {
      ok: true,
      format: result.format,
      valid: result.valid !== false,
      typePiece,
      numero: docNumber,
      nom,
      prenom,
      dateNaissance: birthToIso(birth),
      dateExpiration: expiryToIso(expiry),
      nationalite: nationality,
      sexe: sex,
      raw: lines,
      details: result.details || [],
    };
  } catch (err) {
    return { ok: false, msg: err.message || "MRZ illisible", lines };
  }
}

function birthToIso(yymmdd) {
  if (!yymmdd || yymmdd.length !== 6) return "";
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const century = yy > 30 ? 1900 : 2000;
  return `${century + yy}-${mm}-${dd}`;
}

// Les dates d'expiration MRZ sont toujours dans le futur proche (documents
// valides quelques années) — contrairement aux dates de naissance, l'heuristique
// de siècle par pivot ne s'applique pas : on utilise toujours 20xx.
function expiryToIso(yymmdd) {
  if (!yymmdd || yymmdd.length !== 6) return "";
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  return `${2000 + yy}-${mm}-${dd}`;
}
