/** Logique de vérification partagée (web, API, mobile) */

export const CARD_KINDS = {
  PR: { label: "Personnel" },
  PS: { label: "Prestataire" },
  VI: { label: "Visiteur" },
};

export const today = () => new Date().toISOString().slice(0, 10);

export const defaultValidite = () => `${new Date().getFullYear() + 1}-12-31`;

export const valCarte = (e) => e.carteValidite || defaultValidite();

export const fmtCourt = (iso) => {
  const [y, m, d] = String(iso || "").split("-");
  return y && m && d ? `${d}/${m}/${y}` : String(iso || "—");
};

export const carteExpiree = (e) => valCarte(e) < today();

export const matricule = (e, kind = "PR") =>
  kind === "PR" && e.matriculeOfficiel
    ? String(e.matriculeOfficiel).toUpperCase()
    : kind + "-" + String(e.id).toUpperCase();

export const hash8 = (s) => {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < s.length; i++) {
    h1 ^= s.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (Math.imul(h2, 31) + s.charCodeAt(i)) >>> 0;
  }
  return (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0"))
    .slice(0, 8)
    .toUpperCase();
};

export const authCode = (e, secret, kind = "PR") => {
  const cfg = CARD_KINDS[kind] || CARD_KINDS.PR;
  const ligne2 =
    kind === "PR"
      ? e.poste || ""
      : kind === "PS"
        ? e.fonction || ""
        : e.motif || "";
  const parts = [matricule(e, kind), e.nom, e.prenom, ligne2, valCarte(e), secret];
  if (kind !== "PR") parts.push(kind);
  if (kind === "VI") parts.push(e.categorie || "Standard");
  return hash8(parts.join("|"));
};

export const decretAuthCode = (d, secret) =>
  hash8(["DC", d.id, d.numero, d.dateDecret, d.objet, secret].join("|"));

export const congeAuthCode = (l, secret) =>
  hash8(["CG", l.id, l.employeeId, l.type, l.debut, l.fin, secret].join("|"));

export const missionAuthCode = (m, secret) =>
  hash8(["OM", m.id, m.employeeId, m.objet, m.destination, m.passeport || "", m.debut, m.fin, secret].join("|"));

/** URL courte pour QR (matricule + code) — plus lisible par l'appareil photo. */
export function qrScanUrl(origin, mat, code) {
  const base = String(origin || "").replace(/\/$/, "");
  return `${base}/?m=${encodeURIComponent(mat)}&c=${encodeURIComponent(code)}`;
}

export const extractVerifyFields = (rawInput, codeFallback = "") => {
  let raw = String(rawInput || "").trim();
  if (!raw) return { mat: "", code: String(codeFallback || "").trim().toUpperCase(), raw: "" };
  try {
    if (/^https?:\/\//i.test(raw) || raw.startsWith("/?")) {
      const u = raw.startsWith("/?") ? new URL(raw, "https://gestipers.local") : new URL(raw);
      const m = u.searchParams.get("m");
      const c = u.searchParams.get("c");
      if (m && c) {
        return {
          mat: m.toUpperCase(),
          code: c.trim().toUpperCase(),
          raw,
        };
      }
      const q = u.searchParams.get("v") || u.searchParams.get("verify");
      if (q) raw = decodeURIComponent(q);
    }
  } catch {
    /* ignore */
  }
  if (/%7C/i.test(raw)) {
    try {
      raw = decodeURIComponent(raw);
    } catch {
      /* ignore */
    }
  }
  let mat = raw.toUpperCase();
  let code = String(codeFallback || "").trim().toUpperCase();
  if (raw.includes("|")) {
    const p = raw.split("|");
    if (p[0] === "GESTIPERS") {
      mat = (p[1] || "").toUpperCase();
      code = (p[5] || "").trim().toUpperCase() || code;
    }
  }
  return { mat, code, raw };
};

export function computeVerifResult(matInput, codeInput, ctx) {
  const { mat, code } = extractVerifyFields(matInput, codeInput);
  const { secret, employees, prestataires, visiteurs, missions, leaves, decrets } = ctx;
  if (!mat) return { ok: false, msg: "Scan ou saisie invalide." };

  let kind = mat.split("-")[0];
  if (kind === "OM") {
    const matNormOM = mat.replace(/[\s.]/g, "");
    const m = missions.find((x) => "OM-" + String(x.id).toUpperCase() === matNormOM);
    if (!m) return { ok: false, msg: "Ordre de mission inconnu dans le registre." };
    if (missionAuthCode(m, secret) !== code)
      return { ok: false, msg: "Code d'authentification invalide — ordre de mission falsifié ou non émis ici." };
    if (m.validation === "Refusée")
      return { ok: false, msg: "Cet ordre de mission a été REFUSÉ — document non valable." };
    return { ok: true, type: "OM", om: m, emp: employees.find((x) => x.id === m.employeeId) || null };
  }
  if (kind === "DC") {
    const matNormDC = mat.replace(/[\s.]/g, "");
    const d = decrets.find((x) => "DC-" + String(x.id).toUpperCase() === matNormDC);
    if (!d) return { ok: false, msg: "Décret inconnu dans le registre." };
    if (decretAuthCode(d, secret) !== code)
      return { ok: false, msg: "Code d'authentification invalide — décret falsifié ou non émis ici." };
    return { ok: true, type: "DC", dc: d };
  }
  if (kind === "CG") {
    const matNormCG = mat.replace(/[\s.]/g, "");
    const l = leaves.find((x) => "CG-" + String(x.id).toUpperCase() === matNormCG);
    if (!l) return { ok: false, msg: "Décision de congé inconnue dans le registre." };
    if (congeAuthCode(l, secret) !== code)
      return { ok: false, msg: "Code d'authentification invalide — décision falsifiée ou non émise ici." };
    if (l.statut !== "Approuvé")
      return { ok: false, msg: "Cette décision de congé n'est pas approuvée — document non valable." };
    return { ok: true, type: "CG", cg: l, emp: employees.find((x) => x.id === l.employeeId) || null };
  }

  const pools = { PR: employees, PS: prestataires, VI: visiteurs };
  let pool = pools[kind];
  if (!pool) {
    kind = "PR";
    pool = employees;
  }
  const matNorm = mat.replace(/[\s.]/g, "");
  const e = pool.find((x) => matricule(x, kind).replace(/[\s.]/g, "") === matNorm);
  if (!e) return { ok: false, msg: "Matricule inconnu dans le registre." };
  if (authCode(e, secret, kind) !== code)
    return { ok: false, msg: "Code d'authentification invalide — carte falsifiée ou non émise ici." };
  return {
    ok: true,
    type: "card",
    kind,
    emp: e,
    expiree: carteExpiree(e),
    validite: valCarte(e),
    label: CARD_KINDS[kind]?.label || "Carte",
  };
}

export const normPieceId = (s) =>
  String(s || "")
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

export const pieceIdsMatch = (a, b) => {
  const x = normPieceId(a);
  const y = normPieceId(b);
  if (!x || !y) return false;
  return x === y || (x.length >= 5 && y.length >= 5 && (x.includes(y) || y.includes(x)));
};

export const namesMatchPiece = (nomA, prenomA, nomB, prenomB) => {
  const n = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");
  return n(nomA) === n(nomB) && n(prenomA) === n(prenomB);
};

export function verifyPieceIdentite({ numero, typePiece, nom, prenom, excludeId }, ctx) {
  const num = normPieceId(numero);
  if (!num || num.length < 4) {
    return {
      niveau: "erreur",
      msg: "Numéro trop court ou invalide (4 caractères minimum).",
      matches: [],
      formatOk: false,
    };
  }
  const matches = [];
  const add = (source, personNom, personPrenom, detail, extra = {}) => {
    matches.push({
      source,
      label: `${personPrenom} ${personNom}`.trim(),
      nom: personNom,
      prenom: personPrenom,
      detail,
      nameOk: namesMatchPiece(nom, prenom, personNom, personPrenom),
      ...extra,
    });
  };

  for (const v of ctx.visiteurs || []) {
    if (pieceIdsMatch(v.pieceId, numero))
      add("Registre visiteurs", v.nom, v.prenom, `Pièce : ${v.pieceId}`, { date: v.dateVisite });
  }
  for (const p of ctx.prestataires || []) {
    if (pieceIdsMatch(p.pieceId, numero))
      add("Registre prestataires", p.nom, p.prenom, `Pièce : ${p.pieceId}`, { societe: p.societe });
  }
  for (const m of ctx.missions || []) {
    if (pieceIdsMatch(m.passeport, numero)) {
      const emp = (ctx.employees || []).find((x) => x.id === m.employeeId);
      add("Ordre de mission", emp?.nom || "—", emp?.prenom || "", `Passeport : ${m.passeport}`, {
        objet: m.objet,
      });
    }
  }
  for (const a of (ctx.audiences || []).filter((x) => x.id !== excludeId)) {
    if (pieceIdsMatch(a.numeroPiece, numero))
      add("Demande d'audience", a.nom, a.prenom, `${a.typePiece} ${a.numeroPiece}`, { statut: a.statut });
  }

  const type = String(typePiece || "CNI").toUpperCase();
  let formatOk = true;
  let formatHint = "";
  if (type === "CNI" && !/^[A-Z0-9]{6,14}$/.test(num)) {
    formatOk = false;
    formatHint = "Format CNI inhabituel — vérifiez le numéro saisi.";
  }
  if (type.includes("PASS") && !/^[A-Z]{1,2}[0-9]{6,9}$/.test(num)) {
    formatOk = false;
    formatHint = "Format passeport inhabituel — vérifiez le numéro saisi.";
  }

  if (matches.length === 0) {
    return {
      niveau: formatOk ? "inconnu" : "doute",
      msg: formatOk ? "Aucune correspondance dans les registres GestiPers." : formatHint,
      matches,
      formatOk,
    };
  }

  const hasName = Boolean(String(nom || "").trim() && String(prenom || "").trim());
  const nameOk = !hasName || matches.some((m) => m.nameOk);
  const nameBad = hasName && matches.some((m) => !m.nameOk);
  let niveau = "conforme";
  let msg = `${matches.length} correspondance(s) trouvée(s) dans les registres.`;
  if (nameBad && !nameOk) {
    niveau = "non_conforme";
    msg = "Le numéro existe mais le nom ne correspond pas aux enregistrements.";
  } else if (nameBad) {
    niveau = "doute";
    msg = "Correspondance partielle — contrôle d'identité recommandé.";
  }
  if (!formatOk && niveau === "conforme") niveau = "doute";

  return { niveau, msg, matches, formatOk };
}

export const pieceVerifFromNiveau = (niveau) =>
  ({
    erreur: "Non vérifiée",
    inconnu: "Doute",
    doute: "Doute",
    conforme: "Conforme",
    non_conforme: "Non conforme",
  })[niveau] || "Non vérifiée";

export function ligne2ForKind(e, kind = "PR") {
  if (kind === "PR") return e.poste || "";
  if (kind === "PS") return e.fonction || "";
  return e.motif || "";
}

export function qrPayload(e, secret, kind = "PR", ligne2Override) {
  const l2 = ligne2Override != null ? ligne2Override : ligne2ForKind(e, kind);
  return [
    "GESTIPERS",
    matricule(e, kind),
    `${String(e.nom || "").toUpperCase()} ${e.prenom || ""}`.trim().slice(0, 34),
    String(l2).slice(0, 30),
    fmtCourt(valCarte(e)),
    authCode(e, secret, kind),
  ].join("|");
}

export function buildVerifContext(state) {
  return {
    secret: state.secret,
    employees: state.employees || [],
    prestataires: state.prestataires || [],
    visiteurs: state.visiteurs || [],
    missions: state.missions || [],
    leaves: state.leaves || [],
    audiences: state.audiences || [],
    decrets: state.decrets || [],
  };
}
