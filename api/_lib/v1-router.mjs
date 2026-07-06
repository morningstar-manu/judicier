import { createToken } from "./auth.mjs";
import {
  loadState,
  setFile,
  findUserByIdentifiant,
  updateUserPassword,
  insertVisiteur,
  insertBagage,
  appendJournal,
} from "./sync.mjs";
import { verifyOfficialDocument, ariaAvailable } from "./aria-identite.mjs";
import {
  jsonResponse,
  optionsResponse,
  requireAuth,
  uid,
  today,
} from "./api-helpers.mjs";
import {
  buildVerifContext,
  computeVerifResult,
  verifyPieceIdentite,
} from "../../packages/shared/verify.mjs";
import { parseMrzFromText } from "../../packages/shared/mrz.mjs";
import { maybeRehash } from "../../packages/shared/password.mjs";
import { ocrFromDataUrl } from "./ocr.mjs";

async function getAppState() {
  const state = await loadState();
  if (!state) throw new Error("Base non initialisée");
  return state;
}

function publicPerson(p) {
  if (!p) return null;
  return {
    id: p.id,
    nom: p.nom,
    prenom: p.prenom,
    poste: p.poste,
    fonction: p.fonction,
    societe: p.societe,
    motif: p.motif,
    pieceId: p.pieceId,
    categorie: p.categorie,
    dateVisite: p.dateVisite,
    carteValidite: p.carteValidite,
    photo: p.photo ? true : false,
  };
}

export async function handleV1Request(method, url, req, bodyText = "") {
  const parsed = new URL(url, "http://localhost");
  const parts = parsed.pathname.replace(/^\/api\/v1\/?/, "").split("/").filter(Boolean);
  const route = parts.join("/");

  if (method === "OPTIONS") return optionsResponse();

  try {
    let body = {};
    if (bodyText) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        return jsonResponse(400, { error: "Corps JSON invalide" });
      }
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        return jsonResponse(400, { error: "Corps JSON invalide" });
      }
    }

    if (route === "auth/login" && method === "POST") {
      const identifiant = String(body.identifiant || "").trim();
      const motDePasse = String(body.motDePasse || "");
      if (!identifiant || !motDePasse) {
        return jsonResponse(400, { error: "identifiant et motDePasse requis" });
      }
      const user = await findUserByIdentifiant(identifiant);
      if (!user) {
        return jsonResponse(401, { error: "Identifiants incorrects" });
      }
      const check = await maybeRehash(motDePasse, user.motDePasse);
      if (!check.ok) {
        return jsonResponse(401, { error: "Identifiants incorrects" });
      }
      if (check.hash !== user.motDePasse) {
        await updateUserPassword(user.id, check.hash);
        user.motDePasse = check.hash;
      }
      const token = createToken(user);
      return jsonResponse(200, {
        token,
        user: { id: user.id, nom: user.nom, identifiant: user.identifiant, role: user.role },
      });
    }

    if (route === "auth/me" && method === "GET") {
      const auth = requireAuth(req);
      if (auth.error) return auth.error;
      const state = await getAppState();
      const user = (state.users || []).find((u) => u.id === auth.user.sub);
      if (!user) return jsonResponse(404, { error: "Utilisateur introuvable" });
      return jsonResponse(200, {
        user: { id: user.id, nom: user.nom, identifiant: user.identifiant, role: user.role },
      });
    }

    if (route === "health" && method === "GET") {
      return jsonResponse(200, {
        ok: true,
        service: "gestipers-api",
        version: "1.0.0",
        ariaIdentite: ariaAvailable(),
      });
    }

    const auth = requireAuth(req);
    if (auth.error) return auth.error;
    const actor = auth.user;

    if (route === "verify/card" && method === "POST") {
      const raw = body.raw || body.matricule || body.qr || "";
      const code = body.code || "";
      const state = await getAppState();
      const ctx = buildVerifContext(state);
      const result = computeVerifResult(raw, code, ctx);
      if (!result.ok) return jsonResponse(200, { ok: false, msg: result.msg });

      if (result.type === "OM") {
        return jsonResponse(200, {
          ok: true,
          type: "OM",
          msg: "Ordre de mission authentique",
          person: publicPerson(result.emp),
          mission: { id: result.om.id, objet: result.om.objet, destination: result.om.destination },
        });
      }
      if (result.type === "DC") {
        return jsonResponse(200, {
          ok: true,
          type: "DC",
          msg: "Décret authentique",
          decret: { numero: result.dc.numero, objet: result.dc.objet, date: result.dc.dateDecret },
        });
      }
      if (result.type === "CG") {
        return jsonResponse(200, {
          ok: true,
          type: "CG",
          msg: "Décision de congé authentique",
          person: publicPerson(result.emp),
          conge: { type: result.cg.type, debut: result.cg.debut, fin: result.cg.fin },
        });
      }
      return jsonResponse(200, {
        ok: true,
        type: "card",
        kind: result.kind,
        label: result.label,
        expiree: result.expiree,
        validite: result.validite,
        msg: result.expiree ? "Carte EXPIRÉE" : "Carte authentique",
        person: publicPerson(result.emp),
      });
    }

    if (route === "verify/id" && method === "POST") {
      const state = await getAppState();
      const ctx = buildVerifContext(state);
      const internal = verifyPieceIdentite(
        {
          numero: body.numero,
          typePiece: body.typePiece || "CNI",
          nom: body.nom,
          prenom: body.prenom,
          excludeId: body.excludeId,
        },
        ctx
      );

      let official = null;
      if (body.official !== false && (body.nom || body.prenom)) {
        official = await verifyOfficialDocument({
          typePiece: body.typePiece || "CNI",
          numero: body.numero,
          nom: body.nom,
          prenom: body.prenom,
          dateNaissance: body.dateNaissance,
          lieuNaissance: body.lieuNaissance,
        });
      }

      return jsonResponse(200, { internal, official });
    }

    if (route === "verify/parse-mrz" && method === "POST") {
      const parsed = parseMrzFromText(body.text || body.ocrText || "");
      return jsonResponse(200, parsed);
    }

    if (route === "verify/scan-mrz" && method === "POST") {
      const dataUrl = body.dataUrl || body.image || "";
      if (!dataUrl) return jsonResponse(400, { error: "dataUrl requis" });
      try {
        const ocrText = await ocrFromDataUrl(dataUrl);
        const parsed = parseMrzFromText(ocrText);
        return jsonResponse(200, { ...parsed, ocrText: ocrText.slice(0, 800) });
      } catch (err) {
        return jsonResponse(500, { ok: false, error: err.message || "OCR échoué" });
      }
    }

    if (route === "verify/official" && method === "POST") {
      const official = await verifyOfficialDocument(body);
      return jsonResponse(200, official);
    }

    if (route === "visiteurs" && method === "GET") {
      const state = await getAppState();
      const date = parsed.searchParams.get("date") || today();
      const list = (state.visiteurs || []).filter((v) => v.dateVisite === date);
      return jsonResponse(200, { date, visiteurs: list.map(publicPerson) });
    }

    if (route === "visiteurs" && method === "POST") {
      if (!body.nom?.trim() || !body.prenom?.trim()) {
        return jsonResponse(400, { error: "nom et prenom requis" });
      }
      const rec = {
        id: uid(),
        nom: body.nom.trim(),
        prenom: body.prenom.trim(),
        pieceId: String(body.pieceId || "").trim(),
        motif: String(body.motif || "Visite").trim(),
        service: String(body.service || "").trim(),
        evenement: String(body.evenement || "").trim(),
        categorie: body.categorie || "Standard",
        dateVisite: body.dateVisite || today(),
        photo: body.photo || "",
        carteValidite: body.carteValidite || body.dateVisite || today(),
      };
      await insertVisiteur(rec);
      await appendJournal({
        id: uid(),
        date: new Date().toISOString(),
        user: actor.nom || actor.identifiant,
        action: "Enregistrement visiteur (mobile)",
        cible: `${rec.prenom} ${rec.nom}`,
      });
      return jsonResponse(201, { visiteur: publicPerson(rec) });
    }

    if (route === "scans" && method === "POST") {
      if (!body.dataUrl && !body.value) {
        return jsonResponse(400, { error: "dataUrl requis (image base64)" });
      }
      const fileId = uid() + uid();
      const key = `ghr:doc:${fileId}`;
      const value = body.dataUrl || body.value;
      await setFile(key, value);
      return jsonResponse(201, {
        id: fileId,
        key,
        nomFichier: body.nomFichier || "scan.jpg",
      });
    }

    if (route === "bagages" && method === "GET") {
      const state = await getAppState();
      const date = parsed.searchParams.get("date") || today();
      const list = (state.bagages || []).filter((b) => b.dateControle === date);
      return jsonResponse(200, { date, controles: list });
    }

    if (route === "bagages" && method === "POST") {
      const rec = {
        id: uid(),
        agentId: actor.sub,
        agentNom: actor.nom || actor.identifiant,
        visiteurId: body.visiteurId || "",
        lieu: String(body.lieu || "").trim(),
        dateControle: body.dateControle || today(),
        typeObjet: String(body.typeObjet || "Bagage").trim(),
        statut: body.statut || "Conforme",
        photoId: body.photoId || "",
        notes: String(body.notes || "").trim(),
        creeLe: new Date().toISOString(),
      };
      if (!["Conforme", "À inspecter", "Refusé"].includes(rec.statut)) {
        return jsonResponse(400, { error: "statut invalide" });
      }
      await insertBagage(rec);
      await appendJournal({
        id: uid(),
        date: new Date().toISOString(),
        user: actor.nom || actor.identifiant,
        action: "Contrôle bagage (mobile)",
        cible: `${rec.typeObjet} — ${rec.statut}`,
      });
      return jsonResponse(201, { controle: rec });
    }

    return jsonResponse(404, { error: "Route introuvable", path: route });
  } catch (err) {
    console.error("[api/v1]", err);
    return jsonResponse(500, { error: err.message || "Erreur serveur" });
  }
}

export async function handleV1NodeRequest(req, res) {
  let bodyText = "";
  if (req.method === "POST" || req.method === "PUT") {
    bodyText = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => resolve(Buffer.concat(chunks).toString()));
      req.on("error", reject);
    });
  }
  const url = req.url || "/api/v1";
  const result = await handleV1Request(req.method, url, req, bodyText);
  for (const [k, v] of Object.entries(result.headers || {})) {
    res.setHeader(k, v);
  }
  res.statusCode = result.status;
  res.end(result.body);
}
