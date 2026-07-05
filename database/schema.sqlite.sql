-- GestiPers — schéma SQLite / Turso (LibSQL)
-- Adapté depuis gestipers.sql (MySQL)

CREATE TABLE IF NOT EXISTS parametres (
  cle    TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS utilisateurs (
  client_id    TEXT PRIMARY KEY,
  nom          TEXT NOT NULL,
  identifiant  TEXT NOT NULL UNIQUE,
  mot_de_passe TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'NIVEAU_3' CHECK (role IN ('NIVEAU_1', 'NIVEAU_2', 'NIVEAU_3')),
  cree_le      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS departements (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nom     TEXT NOT NULL UNIQUE,
  couleur TEXT NOT NULL DEFAULT '#0E7C7B'
);

CREATE TABLE IF NOT EXISTS agents (
  client_id          TEXT PRIMARY KEY,
  nom                TEXT NOT NULL,
  prenom             TEXT NOT NULL DEFAULT '',
  poste              TEXT NOT NULL DEFAULT '',
  grade              TEXT NOT NULL DEFAULT '',
  matricule_officiel TEXT NOT NULL DEFAULT '',
  hierarchie         TEXT NOT NULL DEFAULT '',
  departement_id     INTEGER NOT NULL REFERENCES departements(id),
  salaire            INTEGER NOT NULL DEFAULT 0,
  telephone          TEXT NOT NULL DEFAULT '',
  email              TEXT NOT NULL DEFAULT '',
  date_embauche      TEXT,
  statut             TEXT NOT NULL DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Inactif')),
  photo              TEXT,
  carte_validite     TEXT,
  cree_le            TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conges (
  client_id   TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL REFERENCES agents(client_id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  date_debut  TEXT NOT NULL,
  date_fin    TEXT NOT NULL,
  motif       TEXT NOT NULL DEFAULT '',
  statut      TEXT NOT NULL DEFAULT 'En attente' CHECK (statut IN ('En attente', 'Approuvé', 'Refusé')),
  cree_le     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS presences (
  date_jour TEXT NOT NULL,
  agent_id  TEXT NOT NULL REFERENCES agents(client_id) ON DELETE CASCADE,
  valeur    TEXT NOT NULL,
  PRIMARY KEY (date_jour, agent_id)
);

CREATE TABLE IF NOT EXISTS missions (
  client_id   TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL REFERENCES agents(client_id) ON DELETE CASCADE,
  objet       TEXT NOT NULL,
  destination TEXT NOT NULL DEFAULT '',
  passeport   TEXT NOT NULL DEFAULT '',
  photo       TEXT,
  date_debut  TEXT NOT NULL,
  date_fin    TEXT NOT NULL,
  validation  TEXT NOT NULL DEFAULT 'En attente' CHECK (validation IN ('En attente', 'Validée', 'Refusée')),
  cree_le     TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prestataires (
  client_id      TEXT PRIMARY KEY,
  nom            TEXT NOT NULL,
  prenom         TEXT NOT NULL DEFAULT '',
  societe        TEXT NOT NULL DEFAULT '',
  fonction       TEXT NOT NULL DEFAULT '',
  piece_id       TEXT NOT NULL DEFAULT '',
  telephone      TEXT NOT NULL DEFAULT '',
  email          TEXT NOT NULL DEFAULT '',
  contrat_debut  TEXT,
  contrat_fin    TEXT,
  statut         TEXT NOT NULL DEFAULT 'Actif' CHECK (statut IN ('Actif', 'Inactif')),
  photo          TEXT,
  carte_validite TEXT,
  cree_le        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS evenements (
  client_id  TEXT PRIMARY KEY,
  nom        TEXT NOT NULL,
  lieu       TEXT NOT NULL DEFAULT '',
  date_debut TEXT NOT NULL,
  date_fin   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audiences (
  client_id       TEXT PRIMARY KEY,
  nom             TEXT NOT NULL,
  prenom          TEXT NOT NULL DEFAULT '',
  type_piece      TEXT NOT NULL DEFAULT 'CNI',
  numero_piece    TEXT NOT NULL DEFAULT '',
  nationalite     TEXT NOT NULL DEFAULT 'Centrafricaine',
  telephone       TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  objet           TEXT NOT NULL DEFAULT '',
  service_dest    TEXT NOT NULL DEFAULT '',
  date_souhaitee  TEXT,
  heure_souhaitee TEXT NOT NULL DEFAULT '',
  statut          TEXT NOT NULL DEFAULT 'En attente' CHECK (statut IN ('En attente', 'Validée', 'Refusée', 'Tenue')),
  piece_verif     TEXT NOT NULL DEFAULT 'Non vérifiée' CHECK (piece_verif IN ('Non vérifiée', 'Conforme', 'Non conforme', 'Doute')),
  notes           TEXT NOT NULL DEFAULT '',
  cree_le         TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS visiteurs (
  client_id      TEXT PRIMARY KEY,
  nom            TEXT NOT NULL,
  prenom         TEXT NOT NULL DEFAULT '',
  piece_id       TEXT NOT NULL DEFAULT '',
  motif          TEXT NOT NULL DEFAULT '',
  service        TEXT NOT NULL DEFAULT '',
  evenement_id   TEXT REFERENCES evenements(client_id) ON DELETE SET NULL,
  evenement_nom  TEXT NOT NULL DEFAULT '',
  categorie      TEXT NOT NULL DEFAULT 'Standard',
  date_visite    TEXT NOT NULL,
  photo          TEXT,
  carte_validite TEXT,
  cree_le        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dossiers_documents (
  client_id   TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL REFERENCES agents(client_id) ON DELETE CASCADE,
  intitule    TEXT NOT NULL,
  fichier_id  TEXT NOT NULL,
  nom_fichier TEXT NOT NULL,
  mime        TEXT NOT NULL DEFAULT 'application/octet-stream',
  taille      INTEGER NOT NULL DEFAULT 0,
  ref_doc     TEXT,
  date_ajout  TEXT NOT NULL,
  ajoute_par  TEXT NOT NULL DEFAULT '—'
);

CREATE TABLE IF NOT EXISTS decrets (
  client_id    TEXT PRIMARY KEY,
  numero       TEXT NOT NULL,
  date_decret  TEXT NOT NULL,
  objet        TEXT NOT NULL,
  texte        TEXT,
  agent_id     TEXT REFERENCES agents(client_id) ON DELETE SET NULL,
  fichier_id   TEXT,
  fichier_nom  TEXT,
  cree_par     TEXT,
  cree_le      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal (
  client_id   TEXT PRIMARY KEY,
  date_action TEXT NOT NULL,
  utilisateur TEXT NOT NULL,
  action      TEXT NOT NULL,
  cible       TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS fichiers (
  cle     TEXT PRIMARY KEY,
  contenu TEXT NOT NULL,
  maj_le  TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audiences_statut ON audiences(statut);
CREATE INDEX IF NOT EXISTS idx_audiences_piece ON audiences(numero_piece);

CREATE INDEX IF NOT EXISTS idx_agents_dept ON agents(departement_id);
CREATE INDEX IF NOT EXISTS idx_conges_agent ON conges(agent_id);
CREATE INDEX IF NOT EXISTS idx_journal_date ON journal(date_action);
