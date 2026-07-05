import { ensureSchema, getTurso } from "./turso.mjs";

const ROLE_TO_DB = {
  Administrateur: "NIVEAU_1",
  Gestionnaire: "NIVEAU_2",
  Utilisateur: "NIVEAU_3",
};

const ROLE_FROM_DB = {
  NIVEAU_1: "Administrateur",
  NIVEAU_2: "Gestionnaire",
  NIVEAU_3: "Utilisateur",
};

function str(v) {
  return v == null ? "" : String(v);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function loadStateVersion() {
  await ensureSchema();
  const db = getTurso();
  const secretRes = await db.execute(
    "SELECT valeur FROM parametres WHERE cle = 'secret' LIMIT 1"
  ).catch(() => ({ rows: [] }));
  if (!secretRes.rows.length) return null;
  const vRes = await db.execute(
    "SELECT valeur FROM parametres WHERE cle = 'data_version' LIMIT 1"
  ).catch(() => ({ rows: [] }));
  return vRes.rows[0]?.valeur ?? "0";
}

export async function loadState() {
  await ensureSchema();
  const db = getTurso();

  const secretRes = await db.execute(
    "SELECT valeur FROM parametres WHERE cle = 'secret' LIMIT 1"
  ).catch(() => ({ rows: [] }));
  if (!secretRes.rows.length) return null;

  const params = await db.execute("SELECT cle, valeur FROM parametres");
  const pmap = Object.fromEntries(params.rows.map((r) => [r.cle, r.valeur]));

  const depts = await db.execute(
    "SELECT id, nom, couleur FROM departements ORDER BY nom"
  );
  const departments = depts.rows.map((r) => ({
    id: String(r.id),
    nom: r.nom,
    couleur: r.couleur,
  }));
  const deptById = Object.fromEntries(
    depts.rows.map((r) => [r.id, r.nom])
  );

  const usersRes = await db.execute(
    "SELECT client_id, nom, identifiant, mot_de_passe, role FROM utilisateurs"
  );
  const users = usersRes.rows.map((r) => ({
    id: r.client_id,
    nom: r.nom,
    identifiant: r.identifiant,
    motDePasse: r.mot_de_passe,
    role: ROLE_FROM_DB[r.role] || "Utilisateur",
  }));

  const agentsRes = await db.execute(`
    SELECT client_id, nom, prenom, poste, grade, matricule_officiel, hierarchie,
           departement_id, salaire, telephone, email, date_embauche, statut, photo, carte_validite
    FROM agents
  `);
  const employees = agentsRes.rows.map((r) => ({
    id: r.client_id,
    nom: r.nom,
    prenom: r.prenom,
    poste: r.poste,
    grade: r.grade,
    matriculeOfficiel: r.matricule_officiel,
    hierarchie: r.hierarchie,
    departement: deptById[r.departement_id] || "",
    salaire: num(r.salaire),
    telephone: r.telephone,
    email: r.email,
    dateEmbauche: r.date_embauche || "",
    statut: r.statut,
    photo: r.photo || "",
    carteValidite: r.carte_validite || "",
  }));

  const leavesRes = await db.execute(
    "SELECT client_id, agent_id, type, date_debut, date_fin, motif, statut FROM conges"
  );
  const leaves = leavesRes.rows.map((r) => ({
    id: r.client_id,
    employeeId: r.agent_id,
    type: r.type,
    debut: r.date_debut,
    fin: r.date_fin,
    motif: r.motif,
    statut: r.statut,
  }));

  const presRes = await db.execute(
    "SELECT date_jour, agent_id, valeur FROM presences"
  );
  const attendance = {};
  for (const r of presRes.rows) {
    const day = r.date_jour;
    if (!attendance[day]) attendance[day] = {};
    attendance[day][r.agent_id] = r.valeur;
  }

  const missionsRes = await db.execute(`
    SELECT client_id, agent_id, objet, destination, passeport, photo,
           date_debut, date_fin, validation FROM missions
  `);
  const missions = missionsRes.rows.map((r) => ({
    id: r.client_id,
    employeeId: r.agent_id,
    objet: r.objet,
    destination: r.destination,
    passeport: r.passeport,
    photo: r.photo || "",
    debut: r.date_debut,
    fin: r.date_fin,
    validation: r.validation,
  }));

  const prestRes = await db.execute(`
    SELECT client_id, nom, prenom, societe, fonction, piece_id, telephone, email,
           contrat_debut, contrat_fin, statut, photo, carte_validite FROM prestataires
  `);
  const prestataires = prestRes.rows.map((r) => ({
    id: r.client_id,
    nom: r.nom,
    prenom: r.prenom,
    societe: r.societe,
    fonction: r.fonction,
    pieceId: r.piece_id,
    telephone: r.telephone,
    email: r.email,
    contratDebut: r.contrat_debut || "",
    contratFin: r.contrat_fin || "",
    statut: r.statut,
    photo: r.photo || "",
    carteValidite: r.carte_validite || "",
  }));

  const evtRes = await db.execute(
    "SELECT client_id, nom, lieu, date_debut, date_fin FROM evenements"
  );
  const evenements = evtRes.rows.map((r) => ({
    id: r.client_id,
    nom: r.nom,
    lieu: r.lieu,
    dateDebut: r.date_debut,
    dateFin: r.date_fin,
  }));

  const visRes = await db.execute(`
    SELECT client_id, nom, prenom, piece_id, motif, service, evenement_id,
           evenement_nom, categorie, date_visite, photo, carte_validite FROM visiteurs
  `);
  const visiteurs = visRes.rows.map((r) => ({
    id: r.client_id,
    nom: r.nom,
    prenom: r.prenom,
    pieceId: r.piece_id,
    motif: r.motif,
    service: r.service,
    evenement: r.evenement_nom || "",
    categorie: r.categorie,
    dateVisite: r.date_visite,
    photo: r.photo || "",
    carteValidite: r.carte_validite || "",
  }));

  const audRes = await db.execute(`
    SELECT client_id, nom, prenom, type_piece, numero_piece, nationalite, telephone, email,
           objet, service_dest, date_souhaitee, heure_souhaitee, statut, piece_verif,
           piece_fichier_id, piece_nom_fichier, notes, cree_le
    FROM audiences
  `);
  const audiences = audRes.rows.map((r) => ({
    id: r.client_id,
    nom: r.nom,
    prenom: r.prenom,
    typePiece: r.type_piece || "CNI",
    numeroPiece: r.numero_piece || "",
    nationalite: r.nationalite || "",
    telephone: r.telephone || "",
    email: r.email || "",
    objet: r.objet || "",
    serviceDest: r.service_dest || "",
    dateSouhaitee: r.date_souhaitee || "",
    heureSouhaitee: r.heure_souhaitee || "",
    statut: r.statut || "En attente",
    pieceVerif: r.piece_verif || "Non vérifiée",
    pieceFichierId: r.piece_fichier_id || "",
    pieceNomFichier: r.piece_nom_fichier || "",
    notes: r.notes || "",
    creeLe: r.cree_le || "",
  }));

  const dossRes = await db.execute(`
    SELECT client_id, agent_id, intitule, fichier_id, nom_fichier, mime, taille,
           ref_doc, date_ajout, ajoute_par FROM dossiers_documents
  `);
  const dossiers = dossRes.rows.map((r) => ({
    id: r.client_id,
    employeeId: r.agent_id,
    intitule: r.intitule,
    fichierId: r.fichier_id,
    nomFichier: r.nom_fichier,
    type: r.mime,
    taille: num(r.taille),
    refDoc: r.ref_doc || undefined,
    date: r.date_ajout,
    user: r.ajoute_par,
  }));

  const decRes = await db.execute(`
    SELECT client_id, numero, date_decret, objet, texte, agent_id, fichier_id,
           fichier_nom, cree_par FROM decrets
  `);
  const decrets = decRes.rows.map((r) => ({
    id: r.client_id,
    numero: r.numero,
    dateDecret: r.date_decret,
    objet: r.objet,
    texte: r.texte || "",
    employeeId: r.agent_id || "",
    fichierId: r.fichier_id || "",
    nomFichier: r.fichier_nom || "",
    creePar: r.cree_par || "",
  }));

  const journalRes = await db.execute(
    "SELECT client_id, date_action, utilisateur, action, cible FROM journal ORDER BY date_action"
  );
  const journal = journalRes.rows.map((r) => ({
    id: r.client_id,
    date: r.date_action,
    user: r.utilisateur,
    action: r.action,
    cible: r.cible,
  }));

  const bagRes = await db.execute(`
    SELECT client_id, agent_id, agent_nom, visiteur_id, lieu, date_controle,
           type_objet, statut, photo_id, notes, cree_le FROM controles_bagages
  `).catch(() => ({ rows: [] }));
  const bagages = bagRes.rows.map((r) => ({
    id: r.client_id,
    agentId: r.agent_id || "",
    agentNom: r.agent_nom || "",
    visiteurId: r.visiteur_id || "",
    lieu: r.lieu || "",
    dateControle: r.date_controle,
    typeObjet: r.type_objet || "Bagage",
    statut: r.statut || "Conforme",
    photoId: r.photo_id || "",
    notes: r.notes || "",
    creeLe: r.cree_le || "",
  }));

  return {
    secret: pmap.secret,
    lang: pmap.langue || "fr",
    tp2026: pmap.tp2026 === "1",
    dataVersion: pmap.data_version || "0",
    departments,
    users,
    employees,
    leaves,
    attendance,
    missions,
    prestataires,
    visiteurs,
    audiences,
    evenements,
    dossiers,
    decrets,
    journal,
    bagages,
  };
}

export async function saveState(data) {
  await ensureSchema();
  const db = getTurso();
  const batch = [];

  batch.push({ sql: "DELETE FROM journal" });
  batch.push({ sql: "DELETE FROM controles_bagages" });
  batch.push({ sql: "DELETE FROM dossiers_documents" });
  batch.push({ sql: "DELETE FROM decrets" });
  batch.push({ sql: "DELETE FROM presences" });
  batch.push({ sql: "DELETE FROM conges" });
  batch.push({ sql: "DELETE FROM missions" });
  batch.push({ sql: "DELETE FROM visiteurs" });
  batch.push({ sql: "DELETE FROM audiences" });
  batch.push({ sql: "DELETE FROM prestataires" });
  batch.push({ sql: "DELETE FROM evenements" });
  batch.push({ sql: "DELETE FROM agents" });
  batch.push({ sql: "DELETE FROM utilisateurs" });
  batch.push({ sql: "DELETE FROM departements" });
  batch.push({ sql: "DELETE FROM parametres" });

  batch.push({
    sql: "INSERT INTO parametres (cle, valeur) VALUES (?, ?)",
    args: ["secret", str(data.secret)],
  });
  batch.push({
    sql: "INSERT INTO parametres (cle, valeur) VALUES (?, ?)",
    args: ["langue", str(data.lang || "fr")],
  });
  batch.push({
    sql: "INSERT INTO parametres (cle, valeur) VALUES (?, ?)",
    args: ["tp2026", data.tp2026 ? "1" : "0"],
  });
  batch.push({
    sql: "INSERT INTO parametres (cle, valeur) VALUES (?, ?)",
    args: ["data_version", String(Date.now())],
  });

  const deptNameToId = new Map();
  for (const d of data.departments || []) {
    batch.push({
      sql: "INSERT INTO departements (nom, couleur) VALUES (?, ?)",
      args: [d.nom, d.couleur || "#0E7C7B"],
    });
  }

  await db.batch(batch, "write");

  const deptsInserted = await db.execute(
    "SELECT id, nom FROM departements"
  );
  for (const r of deptsInserted.rows) {
    deptNameToId.set(r.nom, r.id);
  }
  const firstDeptId = deptsInserted.rows[0]?.id ?? null;

  const batch2 = [];

  for (const u of data.users || []) {
    batch2.push({
      sql: `INSERT INTO utilisateurs (client_id, nom, identifiant, mot_de_passe, role)
            VALUES (?, ?, ?, ?, ?)`,
      args: [
        u.id,
        u.nom,
        u.identifiant,
        u.motDePasse,
        ROLE_TO_DB[u.role] || "NIVEAU_3",
      ],
    });
  }

  for (const e of data.employees || []) {
    const deptId =
      deptNameToId.get(e.departement) ?? firstDeptId;
    if (!deptId) continue;
    batch2.push({
      sql: `INSERT INTO agents (client_id, nom, prenom, poste, grade, matricule_officiel,
            hierarchie, departement_id, salaire, telephone, email, date_embauche, statut, photo, carte_validite)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        e.id,
        e.nom,
        e.prenom || "",
        e.poste || "",
        e.grade || "",
        e.matriculeOfficiel || "",
        e.hierarchie || "",
        deptId,
        num(e.salaire),
        e.telephone || "",
        e.email || "",
        e.dateEmbauche || null,
        e.statut || "Actif",
        e.photo || null,
        e.carteValidite || null,
      ],
    });
  }

  for (const ev of data.evenements || []) {
    batch2.push({
      sql: `INSERT INTO evenements (client_id, nom, lieu, date_debut, date_fin)
            VALUES (?, ?, ?, ?, ?)`,
      args: [ev.id, ev.nom, ev.lieu || "", ev.dateDebut, ev.dateFin],
    });
  }

  for (const p of data.prestataires || []) {
    batch2.push({
      sql: `INSERT INTO prestataires (client_id, nom, prenom, societe, fonction, piece_id,
            telephone, email, contrat_debut, contrat_fin, statut, photo, carte_validite)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        p.id,
        p.nom,
        p.prenom || "",
        p.societe || "",
        p.fonction || "",
        p.pieceId || "",
        p.telephone || "",
        p.email || "",
        p.contratDebut || null,
        p.contratFin || null,
        p.statut || "Actif",
        p.photo || null,
        p.carteValidite || null,
      ],
    });
  }

  for (const v of data.visiteurs || []) {
    const evt = (data.evenements || []).find((e) => e.nom === v.evenement);
    batch2.push({
      sql: `INSERT INTO visiteurs (client_id, nom, prenom, piece_id, motif, service,
            evenement_id, evenement_nom, categorie, date_visite, photo, carte_validite)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        v.id,
        v.nom,
        v.prenom || "",
        v.pieceId || "",
        v.motif || "",
        v.service || "",
        evt?.id || null,
        v.evenement || "",
        v.categorie || "Standard",
        v.dateVisite,
        v.photo || null,
        v.carteValidite || null,
      ],
    });
  }

  for (const a of data.audiences || []) {
    batch2.push({
      sql: `INSERT INTO audiences (client_id, nom, prenom, type_piece, numero_piece, nationalite,
            telephone, email, objet, service_dest, date_souhaitee, heure_souhaitee,
            statut, piece_verif, piece_fichier_id, piece_nom_fichier, notes, cree_le)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        a.id,
        a.nom,
        a.prenom || "",
        a.typePiece || "CNI",
        a.numeroPiece || "",
        a.nationalite || "Centrafricaine",
        a.telephone || "",
        a.email || "",
        a.objet || "",
        a.serviceDest || "",
        a.dateSouhaitee || null,
        a.heureSouhaitee || "",
        a.statut || "En attente",
        a.pieceVerif || "Non vérifiée",
        a.pieceFichierId || "",
        a.pieceNomFichier || "",
        a.notes || "",
        a.creeLe || new Date().toISOString(),
      ],
    });
  }

  for (const m of data.missions || []) {
    batch2.push({
      sql: `INSERT INTO missions (client_id, agent_id, objet, destination, passeport, photo,
            date_debut, date_fin, validation) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        m.id,
        m.employeeId,
        m.objet,
        m.destination || "",
        m.passeport || "",
        m.photo || null,
        m.debut,
        m.fin,
        m.validation || "En attente",
      ],
    });
  }

  for (const l of data.leaves || []) {
    batch2.push({
      sql: `INSERT INTO conges (client_id, agent_id, type, date_debut, date_fin, motif, statut)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        l.id,
        l.employeeId,
        l.type,
        l.debut,
        l.fin,
        l.motif || "",
        l.statut || "En attente",
      ],
    });
  }

  for (const [day, agents] of Object.entries(data.attendance || {})) {
    for (const [agentId, valeur] of Object.entries(agents)) {
      batch2.push({
        sql: `INSERT INTO presences (date_jour, agent_id, valeur) VALUES (?, ?, ?)`,
        args: [day, agentId, valeur],
      });
    }
  }

  for (const d of data.dossiers || []) {
    batch2.push({
      sql: `INSERT INTO dossiers_documents (client_id, agent_id, intitule, fichier_id, nom_fichier,
            mime, taille, ref_doc, date_ajout, ajoute_par) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        d.id,
        d.employeeId,
        d.intitule,
        d.fichierId,
        d.nomFichier,
        d.type || "application/octet-stream",
        num(d.taille),
        d.refDoc || null,
        d.date,
        d.user || "—",
      ],
    });
  }

  for (const dc of data.decrets || []) {
    batch2.push({
      sql: `INSERT INTO decrets (client_id, numero, date_decret, objet, texte, agent_id,
            fichier_id, fichier_nom, cree_par) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        dc.id,
        dc.numero,
        dc.dateDecret,
        dc.objet,
        dc.texte || "",
        dc.employeeId || null,
        dc.fichierId || null,
        dc.nomFichier || null,
        dc.creePar || null,
      ],
    });
  }

  for (const b of data.bagages || []) {
    batch2.push({
      sql: `INSERT INTO controles_bagages (client_id, agent_id, agent_nom, visiteur_id, lieu,
            date_controle, type_objet, statut, photo_id, notes, cree_le)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        b.id,
        b.agentId || "",
        b.agentNom || "",
        b.visiteurId || "",
        b.lieu || "",
        b.dateControle,
        b.typeObjet || "Bagage",
        b.statut || "Conforme",
        b.photoId || "",
        b.notes || "",
        b.creeLe || new Date().toISOString(),
      ],
    });
  }

  for (const j of data.journal || []) {
    batch2.push({
      sql: `INSERT INTO journal (client_id, date_action, utilisateur, action, cible)
            VALUES (?, ?, ?, ?, ?)`,
      args: [j.id, j.date, j.user, j.action, j.cible || ""],
    });
  }

  if (batch2.length) {
    await db.batch(batch2, "write");
  }
}

export async function getFile(key) {
  const meta = await getFileMeta(key);
  return meta?.contenu ?? null;
}

export async function getFileMeta(key) {
  await ensureSchema();
  const db = getTurso();
  const r = await db.execute({
    sql: "SELECT contenu, maj_le FROM fichiers WHERE cle = ?",
    args: [key],
  });
  if (!r.rows[0]) return null;
  return {
    contenu: r.rows[0].contenu,
    version: String(r.rows[0].maj_le || ""),
  };
}

export async function setFile(key, value) {
  await ensureSchema();
  const db = getTurso();
  await db.execute({
    sql: `INSERT INTO fichiers (cle, contenu, maj_le) VALUES (?, ?, datetime('now'))
          ON CONFLICT(cle) DO UPDATE SET contenu = excluded.contenu, maj_le = datetime('now')`,
    args: [key, value],
  });
}

export async function deleteFile(key) {
  await ensureSchema();
  const db = getTurso();
  await db.execute({
    sql: "DELETE FROM fichiers WHERE cle = ?",
    args: [key],
  });
}
