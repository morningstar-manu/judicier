-- ============================================================================
--  GestiPers — Base de données SQL
--  Gestion du personnel de la Présidence de la République Centrafricaine
--  Moteur cible : MySQL 8+ / MariaDB 10.5+  (notes PostgreSQL en fin de script)
--  Encodage : utf8mb4 (accents français, cyrillique pour l'interface russe)
--
--  Correspondance avec le programme (stockage JSON "ghr:data") :
--    data.users        -> utilisateurs        data.missions   -> missions
--    data.departments  -> departements        data.journal    -> journal
--    data.employees    -> agents              data.dossiers   -> dossiers_documents
--    data.leaves       -> conges              data.decrets    -> decrets
--    data.attendance   -> presences           data.secret     -> parametres
--    data.prestataires -> prestataires        data.lang       -> parametres
--    data.visiteurs    -> visiteurs           data.evenements -> evenements
--
--  Les codes d'authentification (cartes, OM, CG, DC) ne sont PAS stockés :
--  ils sont recalculés par l'application à partir des champs + parametres.secret.
-- ============================================================================

DROP DATABASE IF EXISTS gestipers;
CREATE DATABASE gestipers CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gestipers;

-- ---------------------------------------------------------------------------
-- Paramètres de l'installation (clé secrète d'authentification, langue)
-- ---------------------------------------------------------------------------
CREATE TABLE parametres (
  cle    VARCHAR(50)  PRIMARY KEY,
  valeur VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

INSERT INTO parametres VALUES
  ('secret', REPLACE(UUID(), '-', '')),   -- clé secrète : régénérée à l'installation, à ne jamais divulguer
  ('langue', 'fr');

-- ---------------------------------------------------------------------------
-- Comptes utilisateurs — 3 niveaux d'autorisation
--   NIVEAU_1 : Administrateur (valider, supprimer, exporter, comptes, journal)
--   NIVEAU_2 : Gestionnaire   (créer, modifier, exporter — sans valider/supprimer)
--   NIVEAU_3 : Utilisateur    (consulter, soumettre des demandes)
-- Le mot de passe doit être stocké HACHÉ par l'application (bcrypt recommandé).
-- ---------------------------------------------------------------------------
CREATE TABLE utilisateurs (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom            VARCHAR(120) NOT NULL,
  identifiant    VARCHAR(60)  NOT NULL UNIQUE,
  mot_de_passe   VARCHAR(255) NOT NULL,
  role           ENUM('NIVEAU_1','NIVEAU_2','NIVEAU_3') NOT NULL DEFAULT 'NIVEAU_3',
  cree_le        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modifie_le     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Compte initial (mot de passe : admin123, haché en SHA2 pour la démonstration ;
-- remplacez par un hachage bcrypt via l'application, puis changez ce mot de passe)
INSERT INTO utilisateurs (nom, identifiant, mot_de_passe, role)
VALUES ('Administrateur principal', 'admin', SHA2('admin123', 256), 'NIVEAU_1');

-- ---------------------------------------------------------------------------
-- Départements / sections de la Présidence
-- ---------------------------------------------------------------------------
CREATE TABLE departements (
  id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom     VARCHAR(160) NOT NULL UNIQUE,
  couleur CHAR(7)      NOT NULL DEFAULT '#0E7C7B'
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Agents (personnels de la Présidence)
-- ---------------------------------------------------------------------------
CREATE TABLE agents (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code_import        VARCHAR(10)  NULL UNIQUE,          -- id d'origine (p001…) pour la reprise des données
  nom                VARCHAR(120) NOT NULL,
  prenom             VARCHAR(120) NOT NULL DEFAULT '',
  poste              VARCHAR(180) NOT NULL DEFAULT '',
  grade              VARCHAR(120) NOT NULL DEFAULT '',
  matricule_officiel VARCHAR(30)  NOT NULL DEFAULT '',
  hierarchie         VARCHAR(10)  NOT NULL DEFAULT '',
  departement_id     INT UNSIGNED NOT NULL,
  salaire            DECIMAL(12,0) NOT NULL DEFAULT 0,  -- FCFA / mois
  telephone          VARCHAR(30)  NOT NULL DEFAULT '',
  email              VARCHAR(120) NOT NULL DEFAULT '',
  date_embauche      DATE NULL,
  statut             ENUM('Actif','Inactif') NOT NULL DEFAULT 'Actif',
  photo              MEDIUMBLOB NULL,                   -- JPEG compressé par l'application
  carte_validite     DATE NULL,                         -- NULL = 31/12 de l'année suivante (défaut applicatif)
  cree_le            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modifie_le         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_agent_dept FOREIGN KEY (departement_id) REFERENCES departements(id) ON DELETE RESTRICT,
  INDEX idx_agent_nom (nom, prenom),
  INDEX idx_agent_matricule (matricule_officiel),
  INDEX idx_agent_statut (statut)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Congés
-- ---------------------------------------------------------------------------
CREATE TABLE conges (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  agent_id    INT UNSIGNED NOT NULL,
  type        VARCHAR(80)  NOT NULL,
  date_debut  DATE NOT NULL,
  date_fin    DATE NOT NULL,
  motif       VARCHAR(300) NOT NULL DEFAULT '',
  statut      ENUM('En attente','Approuvé','Refusé') NOT NULL DEFAULT 'En attente',
  decide_par  INT UNSIGNED NULL,
  decide_le   DATETIME NULL,
  cree_le     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_conge_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  CONSTRAINT fk_conge_user  FOREIGN KEY (decide_par) REFERENCES utilisateurs(id) ON DELETE SET NULL,
  CONSTRAINT chk_conge_dates CHECK (date_fin >= date_debut),
  INDEX idx_conge_statut (statut),
  INDEX idx_conge_dates (date_debut, date_fin)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Feuille de présence (un pointage par agent et par jour)
-- ---------------------------------------------------------------------------
CREATE TABLE presences (
  date_jour  DATE NOT NULL,
  agent_id   INT UNSIGNED NOT NULL,
  valeur     VARCHAR(20) NOT NULL,               -- Présent / Absent (extensible)
  pointe_par INT UNSIGNED NULL,
  pointe_le  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (date_jour, agent_id),
  CONSTRAINT fk_presence_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  CONSTRAINT fk_presence_user  FOREIGN KEY (pointe_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Missions (ordres de mission)
-- ---------------------------------------------------------------------------
CREATE TABLE missions (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  agent_id    INT UNSIGNED NOT NULL,
  objet       VARCHAR(300) NOT NULL,
  destination VARCHAR(160) NOT NULL DEFAULT '',
  passeport   VARCHAR(40)  NOT NULL DEFAULT '',
  photo       MEDIUMBLOB NULL,                   -- photo propre à la mission (sinon celle du dossier)
  date_debut  DATE NOT NULL,
  date_fin    DATE NOT NULL,
  validation  ENUM('En attente','Validée','Refusée') NOT NULL DEFAULT 'En attente',
  valide_par  INT UNSIGNED NULL,
  valide_le   DATETIME NULL,
  cree_par    INT UNSIGNED NULL,
  cree_le     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mission_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  CONSTRAINT fk_mission_valideur FOREIGN KEY (valide_par) REFERENCES utilisateurs(id) ON DELETE SET NULL,
  CONSTRAINT fk_mission_createur FOREIGN KEY (cree_par) REFERENCES utilisateurs(id) ON DELETE SET NULL,
  CONSTRAINT chk_mission_dates CHECK (date_fin >= date_debut),
  INDEX idx_mission_validation (validation),
  INDEX idx_mission_dates (date_debut, date_fin)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Prestataires
-- ---------------------------------------------------------------------------
CREATE TABLE prestataires (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom            VARCHAR(120) NOT NULL,
  prenom         VARCHAR(120) NOT NULL DEFAULT '',
  societe        VARCHAR(160) NOT NULL DEFAULT '',
  fonction       VARCHAR(160) NOT NULL DEFAULT '',
  piece_id       VARCHAR(60)  NOT NULL DEFAULT '',   -- n° carte d'identité ou passeport
  telephone      VARCHAR(30)  NOT NULL DEFAULT '',
  contrat_debut  DATE NULL,
  contrat_fin    DATE NULL,
  statut         ENUM('Actif','Inactif') NOT NULL DEFAULT 'Actif',
  photo          MEDIUMBLOB NULL,
  carte_validite DATE NULL,
  cree_le        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_prest_societe (societe),
  INDEX idx_prest_statut (statut)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Activités / manifestations, puis visiteurs
-- ---------------------------------------------------------------------------
CREATE TABLE evenements (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom        VARCHAR(160) NOT NULL,
  lieu       VARCHAR(160) NOT NULL DEFAULT '',
  date_debut DATE NOT NULL,
  date_fin   DATE NOT NULL,
  CONSTRAINT chk_evt_dates CHECK (date_fin >= date_debut)
) ENGINE=InnoDB;

CREATE TABLE visiteurs (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nom            VARCHAR(120) NOT NULL,
  prenom         VARCHAR(120) NOT NULL DEFAULT '',
  piece_id       VARCHAR(60)  NOT NULL DEFAULT '',
  motif          VARCHAR(300) NOT NULL DEFAULT '',
  service        VARCHAR(160) NOT NULL DEFAULT '',   -- service visité
  categorie      ENUM('Standard','Officiel','VIP','VVIP','Presse','Délégation') NOT NULL DEFAULT 'Standard',
  evenement_id   INT UNSIGNED NULL,
  date_visite    DATE NOT NULL,
  photo          MEDIUMBLOB NULL,
  carte_validite DATE NULL,                          -- badge valable le jour de la visite par défaut
  cree_le        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vis_evt FOREIGN KEY (evenement_id) REFERENCES evenements(id) ON DELETE SET NULL,
  INDEX idx_vis_date (date_visite),
  INDEX idx_vis_categorie (categorie)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Dossiers personnels : pièces numérisées + documents générés (OM/CG archivés)
--   ref_doc : NULL pour un scan manuel ; 'OM:<id>' ou 'CG:<id>' pour un document
--   généré automatiquement à la validation (remplacé à chaque revalidation).
-- ---------------------------------------------------------------------------
CREATE TABLE dossiers_documents (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  agent_id    INT UNSIGNED NOT NULL,
  intitule    VARCHAR(200) NOT NULL,
  fichier     LONGBLOB NOT NULL,
  nom_fichier VARCHAR(200) NOT NULL,
  mime        VARCHAR(100) NOT NULL DEFAULT 'application/octet-stream',
  taille      INT UNSIGNED NOT NULL DEFAULT 0,
  ref_doc     VARCHAR(40) NULL,
  ajoute_par  INT UNSIGNED NULL,
  ajoute_le   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_user  FOREIGN KEY (ajoute_par) REFERENCES utilisateurs(id) ON DELETE SET NULL,
  UNIQUE KEY uq_doc_ref (agent_id, ref_doc),
  INDEX idx_doc_agent (agent_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Décrets (registre), avec scan facultatif et lien facultatif vers un agent
-- ---------------------------------------------------------------------------
CREATE TABLE decrets (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  numero       VARCHAR(60)  NOT NULL,
  date_decret  DATE NOT NULL,
  objet        VARCHAR(300) NOT NULL,
  texte        MEDIUMTEXT NULL,
  agent_id     INT UNSIGNED NULL,
  fichier      LONGBLOB NULL,
  fichier_nom  VARCHAR(200) NULL,
  fichier_mime VARCHAR(100) NULL,
  cree_par     INT UNSIGNED NULL,
  cree_le      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_decret_agent FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
  CONSTRAINT fk_decret_user  FOREIGN KEY (cree_par) REFERENCES utilisateurs(id) ON DELETE SET NULL,
  INDEX idx_decret_numero (numero),
  INDEX idx_decret_agent (agent_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Journal de traçabilité (insertion à chaque action ; purge tracée par l'app)
-- ---------------------------------------------------------------------------
CREATE TABLE journal (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  date_action DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  utilisateur VARCHAR(60)  NOT NULL,
  action      VARCHAR(120) NOT NULL,
  cible       VARCHAR(300) NOT NULL DEFAULT '',
  INDEX idx_journal_date (date_action),
  INDEX idx_journal_user (utilisateur)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- Vues utilitaires
-- ---------------------------------------------------------------------------

-- Situation du jour : Au poste / En mission / En congé pour chaque agent actif
CREATE OR REPLACE VIEW v_situation_du_jour AS
SELECT a.id, a.nom, a.prenom, a.matricule_officiel, d.nom AS departement,
  CASE
    WHEN EXISTS (SELECT 1 FROM missions m WHERE m.agent_id = a.id
                   AND m.validation = 'Validée'
                   AND CURRENT_DATE BETWEEN m.date_debut AND m.date_fin) THEN 'En mission'
    WHEN EXISTS (SELECT 1 FROM conges c WHERE c.agent_id = a.id
                   AND c.statut = 'Approuvé'
                   AND CURRENT_DATE BETWEEN c.date_debut AND c.date_fin) THEN 'En congé'
    ELSE 'Au poste'
  END AS situation
FROM agents a
JOIN departements d ON d.id = a.departement_id
WHERE a.statut = 'Actif';

-- Effectif par département
CREATE OR REPLACE VIEW v_effectif_par_departement AS
SELECT d.id, d.nom, d.couleur, COUNT(a.id) AS effectif
FROM departements d
LEFT JOIN agents a ON a.departement_id = d.id AND a.statut = 'Actif'
GROUP BY d.id, d.nom, d.couleur
ORDER BY effectif DESC;

-- Files d'attente de validation
CREATE OR REPLACE VIEW v_missions_en_attente AS
SELECT m.*, a.nom, a.prenom FROM missions m JOIN agents a ON a.id = m.agent_id
WHERE m.validation = 'En attente' ORDER BY m.cree_le;

CREATE OR REPLACE VIEW v_conges_en_attente AS
SELECT c.*, a.nom, a.prenom FROM conges c JOIN agents a ON a.id = c.agent_id
WHERE c.statut = 'En attente' ORDER BY c.cree_le;

-- ---------------------------------------------------------------------------
-- DONNÉES RÉELLES — TABLEAU_PERSONNEL_2026.xlsx
-- 40 départements, 475 agents
-- ---------------------------------------------------------------------------
INSERT INTO departements (nom, couleur) VALUES
  ('Cabinet du Président', '#5B6BB0'),
  ('Secrétariat Général', '#0E7C7B'),
  ('Cabinet Particulier', '#B05B8A'),
  ('Cabinet Civil Ministre Conseiller', '#4A7DB0'),
  ('Collège des Ministres Délégués', '#E8A33D'),
  ('Conseillers', '#7D9A4E'),
  ('Secrétariat Particulier du Chef de l''État', '#A65D3F'),
  ('Cellule Stratégique des Grands Travaux et des Investissements', '#4E8E9A'),
  ('Direction du Protocole', '#5B6BB0'),
  ('Direction de Cabinet – Secrétariat Particulier', '#0E7C7B'),
  ('Secrétariat Général – Cabinet du Ministre Secrétaire Général', '#B05B8A'),
  ('Direction de l''Administration du Palais de la Renaissance', '#4A7DB0'),
  ('Direction du Personnel', '#E8A33D'),
  ('Direction des Services Financiers et du Matériel', '#7D9A4E'),
  ('Direction du Parc Auto', '#A65D3F'),
  ('Direction des Archives Nationales', '#4E8E9A'),
  ('Direction Générale de la Presse Présidentielle', '#5B6BB0'),
  ('Direction de la Presse Présidentielle', '#0E7C7B'),
  ('Direction de la Communication Audio Visuelle', '#B05B8A'),
  ('Direction Technique', '#4A7DB0'),
  ('Direction de la Presse Écrite et en Ligne', '#E8A33D'),
  ('Direction du Secrétariat Commun', '#7D9A4E'),
  ('Direction des Ordres Nationaux', '#A65D3F'),
  ('Service du Secrétariat Commun', '#4E8E9A'),
  ('Cabinet Militaire – Secrétariat Particulier', '#5B6BB0'),
  ('Direction de Santé Camp de Roux', '#0E7C7B'),
  ('Gîte Présidentiel de Mobaye', '#B05B8A'),
  ('Inspection Générale d''État – Secrétariat Particulier', '#4A7DB0'),
  ('Membre de l''Inspection Générale d''État', '#E8A33D'),
  ('Service d''Appui Administratif et Matériel', '#7D9A4E'),
  ('Coordination Nationale de Réforme de Secteur de Sécurité (RSS)', '#A65D3F'),
  ('Réconciliation Nationale (RN)', '#4E8E9A'),
  ('Secrétariat Général du Conseil Supérieur de la Défense Nationale', '#5B6BB0'),
  ('Comité de Suivi de la Mise en Œuvre des Recommandations du Dialogue Républicain', '#0E7C7B'),
  ('Coordination de l''Accord Politique pour la Paix et la Réconciliation', '#B05B8A'),
  ('Cabinet de la Première Dame « Cris du Cœur d''une Femme »', '#4A7DB0'),
  ('Cabinet de la Première Dame ONG Groupefa', '#E8A33D'),
  ('Commission Nationale de Lutte contre la Prolifération des Armes Légères et de Petit Calibre (COMNAT-ALPC)', '#7D9A4E'),
  ('Haut-Commissariat à la Jeunesse Pionnière Nationale (JPN)', '#A65D3F'),
  ('Centre Analytique des Ressources Administratives et Militaires (CARAM)', '#4E8E9A');

INSERT INTO agents (code_import, nom, prenom, poste, grade, matricule_officiel, hierarchie, departement_id, statut) VALUES
  ('p002', 'TOUADERA', 'Faustin Archange', 'Président de la République', 'Professeur Université', '85832A', NULL, 1, 'Actif'),
  ('p003', 'NAMSIO', 'Obed', 'Ministre,D''Etat DIRCAB', 'Magistrat', '40196B', NULL, 2, 'Actif'),
  ('p004', 'MALEYOMBO', 'Donatien', 'Ministre,Chef de Cabinet Particulier', 'Inspecteur des impôt', '52763A', 'A1', 3, 'Actif'),
  ('p005', 'KOYAMBOUNOU', 'Gabriel Jean Edouar', 'Ministre d''Etat Coordonateur du Comité', 'Hors Staut', '101197S', NULL, 4, 'Actif'),
  ('p006', 'NGOUANDJIKA', 'Fidèle', 'Miniistre Cons Spécial', 'Hors staut', '10070R', NULL, 4, 'Actif'),
  ('p007', 'TCHIMANGOUA', 'Thomas Theophile', 'Minis,cons Chef de Cabinet Militaire', 'Gle D''Armée', '9910Z', NULL, 4, 'Actif'),
  ('p008', 'WANZE LINGUISSARA', 'Henri', 'Mins Cordonnateur Documentation de l''Etatr', 'Gle D''Armée', '99664A', NULL, 4, 'Actif'),
  ('p009', 'DOLLE-WAYA', 'Jean Pière', 'Ministre chef d''Etat Major Particulier', 'Gle D''Armée', NULL, NULL, 4, 'Actif'),
  ('p010', 'GAILLOTHY BIBANDA', 'Guy', 'Secretaire Général Conseil Superieur de la Défence', 'Gle de Corps d''Armée', NULL, NULL, 4, 'Actif'),
  ('p011', 'OUAYOLO', 'Bruno', 'Ministre Conseiller', 'Gle de Division', NULL, NULL, 4, 'Actif'),
  ('p012', 'METINKOE', 'Thierry Marie', 'Grand Chancellier', 'Gle de Coprs d''Armée', NULL, NULL, 4, 'Actif'),
  ('p013', 'MOKPENE ALBERT', 'Yaloke', 'Minis, cons porte parole', 'Horst statut', '11060P', NULL, 4, 'Actif'),
  ('p014', 'WENEZOUI', 'Sébastien', 'Ministre, Conseiller Special', 'Ingenieur des Travaux', '66037Z', 'A1', 4, 'Actif'),
  ('p015', 'MBOLI FATRAN', 'Léopold', 'Ministre, Conseiller Special en Matière de Ressoures Naturelles', 'Hors Statut', '100201P', NULL, 4, 'Actif'),
  ('p016', 'FEIZOURE', 'Honoré', 'Ministre, Conseiller Spécial en Matière d''agriculture , d''Elevage et de Développement Rural', 'Hors Statut', '68792M', NULL, 4, 'Actif'),
  ('p017', 'KOYAGBELE BIDA', 'Pascal', 'Mini, Cons, Grand Travaux', 'Hors statut', '101028Z', NULL, 4, 'Actif'),
  ('p018', 'MOSKIT', 'Guy Roger', 'Ministre, Conseiller Spécial', 'Hors Statut', '101153D', NULL, 4, 'Actif'),
  ('p019', 'SANI', 'Yalo', 'Ministre, Conseiller Spécial', 'HORS STAUT', '101155F', NULL, 4, 'Actif'),
  ('p020', 'YANGANA YAHOTE', 'Augustin', 'Ministre, Conseiller Spécial en Matière de l''Administration du Territoire, de Décentralisation et du Développement', 'Hors Statut', '331048E', NULL, 4, 'Actif'),
  ('p021', 'KOUREICHI', 'Maxim', 'Ministre, Conseiller Spécial', NULL, NULL, NULL, 4, 'Actif'),
  ('p022', 'GOUGOUEI', 'Georges', 'Ministre, Con, en charge du nsuivi des projets', 'Hoprs Statut', '11063P', NULL, 4, 'Actif'),
  ('p023', 'KOBA', 'Jean Baptiste', 'Ministre, Conseiller des Investissement', 'Hors Statut', '11073R', NULL, 4, 'Actif'),
  ('p024', 'MOUSSA KEMBE', 'Stanislas', 'Ministre, Conseiller Diplômatique', 'Hors Staut', '11066P', NULL, 4, 'Actif'),
  ('p025', 'YAKETE', 'Joseph', 'Ministre, Conseiller', 'Hors statut', '11050W', NULL, 4, 'Actif'),
  ('p026', 'KOZI', 'Mongot', 'Ministre, Conseiller', 'Hors Statut', '11062P', NULL, 4, 'Actif'),
  ('p027', 'YAOUNGA YIKO PRINCE', 'Borel', 'Ministre Conseiller Coordonateur SENIOR SIGNT', 'Hors Staut', NULL, NULL, 4, 'Actif'),
  ('p028', 'POUMANGUE', 'Gilbert', 'Minis, Cons en Charge des Rela, avec les Inst de Fint du Dpmt', 'Horst statut', '10672T', NULL, 4, 'Actif'),
  ('p029', 'RINGUI LE GAILLARD', 'André', 'Min, Cons, en Charge d''Education Nationale', 'Hors Satut', '100121R', NULL, 4, 'Actif'),
  ('p030', 'LAWSON ROOSALEM', 'Gina', 'Mins, Cons, en char, de l''urbanisme, de la reforme Foncière et de l''habitat', 'Hors statut', '105000D', NULL, 4, 'Actif'),
  ('p031', 'KOKOUENDO', 'Daniel', 'Mins, Cons, en charge de l''Economie Numérique', 'Ingenieur Télécomm', '101210V', NULL, 4, 'Actif'),
  ('p032', 'MOHAMADOU BELLO', 'Saidou', 'Ministre, Conseiller', 'Hors staut', NULL, NULL, 4, 'Actif'),
  ('p033', 'AMADOU BI', 'Aliyou', 'Ministre, Conseiller', 'Horst statut', '11079K', NULL, 4, 'Actif'),
  ('p034', 'SAIDOU', 'Aliyou', 'Ministre, Conseiller', 'Hors staut', NULL, NULL, 4, 'Actif'),
  ('p035', 'ISSA BY', 'Amadou', 'Ministre, Conseiller', 'Hors staut', NULL, NULL, 4, 'Actif'),
  ('p036', 'IDRISS', 'Amadou', 'Ministre, Conseiller', 'Hors staut', NULL, NULL, 4, 'Actif'),
  ('p037', 'DOKOULA', 'Lazar', 'Cons; en matière des Finances', 'Hors Staut', '10955E', 'A1', 5, 'Actif'),
  ('p038', 'ORONFEI', 'FIOGBIAThierry Hervé', 'Mins, Dél, Cons, en Matière de nouvelle Technologie', 'Hors Statut', '11083S', NULL, 5, 'Actif'),
  ('p039', 'KOKATE', 'Joackin', 'Mini, Dél, Cons, Spé', 'Hors Statut', '10009R', NULL, 5, 'Actif'),
  ('p040', 'YALOKE MOKPEME', 'Albert', 'Mins, Dél, Cons,en charge de communi, porte-parole de la Présidence', 'Hors Statut', '11060P', NULL, 5, 'Actif'),
  ('p041', 'OUSMANE TINGUERE', 'Mahamadou', 'Mins, Dél, Cons, en charge de la coopération Internationale', 'Hors Statut', '11085S', NULL, 5, 'Actif'),
  ('p042', 'SEBIRO', 'Maurice Wilfrid', 'Mins, Dél, Cons, en charge de la Communication', 'Hors statut', '11071R', NULL, 5, 'Actif'),
  ('p043', 'MBAYA NENE', 'Alain Nestor', 'Min, Dél, Cons, en charge de la jeunesse et des Org. Non Gouv', 'Hors staut', '11069P', NULL, 5, 'Actif'),
  ('p044', 'DJILITH', 'Abdel Moumine', 'Minis, Dél, Cons, en charge des relations avec les Institu. Natio.', 'Adm Civil', '68772H', 'A1', 5, 'Actif'),
  ('p045', 'HEDI GONISSA', 'Ali', 'Mins, Dél; Cons, en charge de la Diplômatie', 'Adm Civil', '10686Z', NULL, 5, 'Actif'),
  ('p046', 'PINA SANY ALAIN', 'Bruce', 'Min Déle Haut Commissaire PJN', 'Hors Statut', '100677Z', NULL, 5, 'Actif'),
  ('p047', 'KAÏGAMA', 'Benjamin', 'Min Délégué Rapporteur Général', 'Hors staut', '101190J', NULL, 5, 'Actif'),
  ('p048', 'NGUEREMBASSA', 'Patrick', 'Cons. Juridique', 'Hors Satut', '10048Y', NULL, 6, 'Actif'),
  ('p049', 'FARAKOWENA', 'Germain', 'Cons. En matière de l''environ. Et du Develop. Rural.', 'Administrateur Civil', '10001U', NULL, 6, 'Actif'),
  ('p050', 'NZENGUE LANDA', 'Ascain', 'Cons', 'Hors Statut', '100993J', NULL, 6, 'Actif'),
  ('p051', 'DEYA', 'Kalite', NULL, 'Administrateur Civil', '100021M', NULL, 6, 'Actif'),
  ('p052', 'YOKI-DANZA', 'Karl Symphorien', NULL, NULL, NULL, NULL, 6, 'Actif'),
  ('p053', 'GBAMOU', 'Guillaume', 'Cons en mati', 'Ingenieur en Informatique', '88976E', 'A1', 6, 'Actif'),
  ('p054', 'KAMMAME NDJAPOU', 'William Freddy', 'Cons. En matière de Reforme Juridique et de Suivi du Processus Electoral', 'Professeur de l''université', '1', NULL, 6, 'Actif'),
  ('p055', 'ELA', 'Aimery', 'Cons. En charge des Promotions des Droits Humains et de la bonne Gouvernance', 'Horst Satut', '101020R', NULL, 6, 'Actif'),
  ('p056', 'MAKANDA', 'Sidoine', 'Conseiller en charge de Genre et des Affaires Sociales', 'Ingenieur en Informatique', '1011182J', NULL, 6, 'Actif'),
  ('p057', 'DOUGOUPOU', 'Andre', 'Conseiller', 'Attaché d''administra', '10125J', NULL, 6, 'Actif'),
  ('p058', 'TO-SAH BE-NZA', 'Augustin', 'Conseiller Spécial', 'Hors staut', '101204X', NULL, 6, 'Actif'),
  ('p059', 'LAMINE', 'Annette Ernestine', 'Conseiller Spécial', 'Hors Statut', NULL, NULL, 6, 'Actif'),
  ('p060', 'DAOUDA', 'Prospert', 'Conseiller Spécial', 'Horst Satut', '110701L', NULL, 6, 'Actif'),
  ('p061', 'MBOLOBE', 'Julio', 'Conseiller Spécial', 'Hors staut', '110698K', NULL, 6, 'Actif'),
  ('p062', 'MONAGA', 'Yvette', 'Conseiller Spécial', 'Hors staut', NULL, NULL, 6, 'Actif'),
  ('p063', 'ZOUMALE', 'Wilfrreid Gérod', 'Conseiller Spécial', 'Attaché d''administra', '101202V', NULL, 6, 'Actif'),
  ('p064', 'MAMADOU', 'Ramadji', 'Conseiller Spécial', 'Hors Statut', '1010702M', NULL, 6, 'Actif'),
  ('p065', 'LAKOSSO KOKPALE', 'Gervais', 'Conseiller Spécial', 'Hors staut', '01200T', NULL, 6, 'Actif'),
  ('p066', 'IDRISS YAYA', 'Hayat', 'Conseiller en matière de Stigmatisation', NULL, '10051T', NULL, 6, 'Actif'),
  ('p067', 'NZENGUE LANDA', 'Ascain', 'Chargé de Mission en matière de l''action humanitaire', 'Hors Staut', '51878A', NULL, 6, 'Actif'),
  ('p068', 'FARAKOWENA', 'Germain', 'Chargé de Mission', 'Hors staut', '100019U', NULL, 6, 'Actif'),
  ('p069', 'GBAMOU', 'Guillaume', 'Chargé de Mission Nouvelle Technologie', 'Ingenieur en Informatique', NULL, NULL, 6, 'Actif'),
  ('p070', 'KALITE', 'Deya', 'Chargé de Mission à la Promotion des petites et moyennes Entreprise', 'Administrateur Civil', '100021M', 'A1', 6, 'Actif'),
  ('p071', 'OUADDOS', 'Nathalie', 'Assistant au Secrétaire', 'Attaché d''administration', '10120N', 'B3', 7, 'Actif'),
  ('p072', 'KAMEGBA', 'Alain', 'Expert en infractrusture', 'Ingenieur e des TP', NULL, NULL, 8, 'Actif'),
  ('p073', 'DIMANCHE', 'Roger', 'Expert en procedure dappel d offert', 'Hors staut', NULL, NULL, 8, 'Actif'),
  ('p074', 'ENDJIMONGOA', 'Dieudonné', 'Expert administratif financier et des ressources humaines', 'Hors staut', NULL, NULL, 8, 'Actif'),
  ('p075', 'ETONDO', 'Bernard', 'Expert economique', 'Hors Statut', NULL, NULL, 8, 'Actif'),
  ('p076', 'TANGOA', 'Steve Victor', 'Expert juridique', 'Hors Statut', NULL, NULL, 8, 'Actif'),
  ('p077', 'KOBENGO', NULL, 'Expert Mines et Hydrocarbures', 'Hors staut', NULL, NULL, 8, 'Actif'),
  ('p078', 'MAHELENGAMO', NULL, 'Expert environement', 'Hors staut', NULL, NULL, 8, 'Actif'),
  ('p079', 'NGATEWE', 'Melvin', 'Expert investissement', 'Hors staut', NULL, NULL, 8, 'Actif'),
  ('p080', 'KOVOUNGBO', 'Bienvenu Hervé', 'Expert en Matière d Economie', 'Administrateur Civil', NULL, NULL, 8, 'Actif'),
  ('p081', 'MAYEMBO', 'Jean Baptiste', 'Expert chargé des Relations Publiques', 'Administrateur Civil', NULL, NULL, 8, 'Actif'),
  ('p082', 'BANDIO', 'Monique', 'Chef de Sécrétariat commun', 'Hors staut', NULL, NULL, 8, 'Actif'),
  ('p083', 'ZALI VOSSE', 'Régis', 'Assistant en Informatique', 'Hors Staut', NULL, NULL, 8, 'Actif'),
  ('p084', 'DIMBELET', 'Fernand', 'Assistant en Communication', 'Hors staut', NULL, NULL, 8, 'Actif'),
  ('p085', 'MAPOUKA', 'Freddy Mathurin', 'Ambassadeur', 'Administrateur Civil', '10304V', 'A1', 9, 'Actif'),
  ('p086', 'GBELEKO', 'Max', 'DG Protocole', 'Administrateur Civil', NULL, NULL, 9, 'Actif'),
  ('p087', 'NGALLO', 'Hervé', 'Attaché de Protocole', 'Attaché d''Admi', '10.487X', 'B1', 9, 'Actif'),
  ('p088', 'GBIABA', 'Aline', 'Attaché de Protocole', 'Décisionnaire', '10234M', NULL, 9, 'Actif'),
  ('p089', 'DESSA-BABET BALABAL', 'Rose Nathalie', 'Attaché de Protocole', 'Décisionnaire', '10199S', NULL, 9, 'Actif'),
  ('p090', 'GUESSA BABET GUIABA', 'Rodrigue', 'Attaché de Protocole', 'Décisionnaire', '10136K', NULL, 9, 'Actif'),
  ('p091', 'DJONGA', 'Noêlla Geraldine', NULL, NULL, NULL, NULL, 9, 'Actif'),
  ('p092', 'GANZO', 'Jean Bedel Brice', 'Attaché de Protocole', 'Administrateur Civil', NULL, 'A1', 9, 'Actif'),
  ('p093', 'BOYBO', 'Médita Marina Judith', 'Attaché de Protocole', 'Attaché d''administration', NULL, 'B1', 9, 'Actif'),
  ('p094', 'MAMBA', 'Elvine Rose', 'Attaché de Protocole', 'Décisionnaire', NULL, NULL, 9, 'Actif'),
  ('p095', 'MALEYOMBO', 'Bintou', 'Attaché de Protocole', 'Décisionnaire', '10367T', NULL, 9, 'Actif'),
  ('p096', 'MOUTCHOUBOUTCHOU', 'Jesus', 'Attaché de Protocole', 'Décisionnaire', NULL, NULL, 9, 'Actif'),
  ('p097', 'WOWI', 'Lucie', 'Secretaire Particulière du MDDIRCAB', 'Administrateur Civil', NULL, 'A1', 10, 'Actif'),
  ('p098', 'NAMKOISSE EYA OROI', 'Bienvenu', 'Secrétaire', 'Attaché d''administration', '11316D', 'B1', 10, 'Actif'),
  ('p099', 'YAHAO OUAKOLO', 'Maxime', 'Chef de Bureau Courrier Départ et Arrivée', 'Commis Principal d''Administration', '15633M', 'B3', 10, 'Actif'),
  ('p100', 'MOUSSA', 'Robert', 'Chef de Bureau du Secretairiat', 'Attaché d''administration', '10.198M', 'A1', 10, 'Actif'),
  ('p101', 'BISSAKONOU', 'Robert', 'Chef de Bureau du Courriers', 'Secrétaire d''Administration', '10.219Z', 'C1', 11, 'Actif'),
  ('p102', 'ZINIAN', 'Christine', NULL, 'Decisionnaire', '101061A', NULL, 11, 'Actif'),
  ('p103', 'ADAGLO', 'Jean Bruno', 'Chef de Bureau', 'Admi Civ Adjoint', '10165C', 'A2', 11, 'Actif'),
  ('p104', 'DENGUEADE', 'Bernadette', 'Cons. , Gouverneur du PR', 'Hors Statut', NULL, NULL, 12, 'Actif'),
  ('p105', 'SONGOMALI', 'Patricia', 'Intendante Ddu PR', 'Administrateur Adjointe', '10288N', 'A2', 12, 'Actif'),
  ('p106', 'YAGOUMI', 'Daniel', 'Chef de service de restauration du PR', 'Hors statut', '10086N', NULL, 12, 'Actif'),
  ('p107', 'GUELA-DORO', 'Kevin', 'Directeur, Maitre d''hôtel du PR', 'Administrateur Civ Adjoint', '10450U', 'A2', 12, 'Actif'),
  ('p108', 'NGAKOYA', 'Atina Hervine Assétou', 'Chef du Bureau, Secretariat du GP', 'Ouvrier des TP', '10089', 'C1', 12, 'Actif'),
  ('p109', 'FEIKOUMON', 'Wilfred Crépin Brice', 'CS, Horticulture au Gouvernorat du PR AI', 'Ouvrier des TP', '10128X', 'C1', 12, 'Actif'),
  ('p110', 'BERA', 'Blaise', 'CS, Approvi. Au Gouvernorat du PR AI', 'Commis d''Admin', '10296N', 'D1', 12, 'Actif'),
  ('p111', 'FIOBOYE', 'Juliette', 'CB, à la PR', 'Commis d''Admin', '10100J', 'C2', 12, 'Actif'),
  ('p112', 'WEDANE MODONAMSE', 'Maxime', 'CB, Technique au Gouvernorat', 'Attaché Principaux d''Administration', '11304Z', 'A3', 12, 'Actif'),
  ('p113', 'DOTTHE', 'Hyacinthe', 'CB, Electro- froid', 'Attaché d''administration', '101042X', 'CA3', 12, 'Actif'),
  ('p114', 'REGAYO', 'Charles', 'CB, Menuiserie', NULL, NULL, NULL, 12, 'Actif'),
  ('p115', 'GALLA PAKEU', 'Daravola', 'CB Presidence', 'Attachée Principal', '10095F', NULL, 12, 'Actif'),
  ('p116', 'GUERENGAYE', 'Aurélie', 'CB, Restauration du PR', 'Attaché Principaux d''Administration', '10222U', NULL, 12, 'Actif'),
  ('p117', 'MALENGUIZA', 'Herman', 'CB, Horticulture', 'Commis d''Admin', '10229B', 'D1', 12, 'Actif'),
  ('p118', 'MANDA', 'Rodrigue', 'Electricien Présidence', 'Attaché d''Admi', '101032V', NULL, 12, 'Actif'),
  ('p119', 'MANDABA', 'Alban', 'Electricien Présidence', 'Attaché d''administration', NULL, NULL, 12, 'Actif'),
  ('p120', 'FEINDIRO', 'Freddy', 'Plombier à la Présidence', 'Attaché d''administration', NULL, 'B1', 12, 'Actif'),
  ('p121', 'MACKFOY', 'Nicaise', 'Plombier à la Présidence', NULL, '101054B', NULL, 12, 'Actif'),
  ('p122', 'OUILIBONA', 'Michael', 'CB, Approvisionnement A.I', NULL, NULL, NULL, 12, 'Actif'),
  ('p123', 'SONGOHOUTOU', 'Prisca Nina', 'Hôtesse à la Présidence', 'Technicien Principal', '79107W', NULL, 12, 'Actif'),
  ('p124', 'FARABONA', 'Carole', 'Hôtesse à la Présidence', NULL, NULL, NULL, 12, 'Actif'),
  ('p125', 'GAZAMBETI', 'Carine Georgia', 'Hôtesse à la Présidence', 'Commis d''Admin', '101113V', NULL, 12, 'Actif'),
  ('p126', 'DOUI MAKIFO', 'Claude Fernande', 'Hôtesse à la Présidence', 'Attachée Principal', '101040V', 'A3', 12, 'Actif'),
  ('p127', 'KINDA', 'Marina', 'Hôtesse à la Présidence', 'Decisionnaire', '101058F', NULL, 12, 'Actif'),
  ('p128', 'BENAM KONGAINA', 'Tatiana', 'Fille de Salle à la Présidence', 'Secrétaire d''Administration', '101034X', 'C1', 12, 'Actif'),
  ('p129', 'NDOTAR', 'Michelle', 'Cuisinière à la Pr.', NULL, NULL, NULL, 12, 'Actif'),
  ('p130', 'MOHOROWENE', 'Rickyel', 'Hôtesse à la Présidence', 'Attaché d''administration', '101110S', NULL, 12, 'Actif'),
  ('p131', 'GODAME', 'Thèrèse', 'Fille de Salle à la Présidence', NULL, NULL, NULL, 12, 'Actif'),
  ('p132', 'TRESOR ZOBE', 'franciel', 'Maître d''hotel', 'Attaché d''adminstration', '101052Z', NULL, 12, 'Actif'),
  ('p133', 'KPARAMBETI', 'Marina', 'Maître d''hotel', 'Attaché d''administration', '1011124Y', NULL, 12, 'Actif'),
  ('p134', 'NGOAZIER', 'Maruis Aimé', 'Maître d''hotel', 'Commis d''Admin', '101041W', 'C2', 12, 'Actif'),
  ('p135', 'WAMBETI YADENDJI', 'Aimé Emmanuel', 'Maître d''hôtel à la Présidence', 'Attaché d''administration', '101036Z', 'B1', 12, 'Actif'),
  ('p136', 'NGAFOU', 'Guy', 'Serveur à la Présidence', 'Décisionnaire', '101077J', NULL, 12, 'Actif'),
  ('p137', 'MAGBA', 'Vigilance', 'Fille de Salle à la Présidence', 'Décisionnaire', '34056G', NULL, 12, 'Actif'),
  ('p138', 'MORBE', 'Bienvenu', 'Jardinier à la Présidence', 'Décisionnaire', '101108Y', NULL, 12, 'Actif'),
  ('p139', 'KOIRE', 'Pièrre', 'Jardinier à la Présidence', 'Attaché d''admin', '11274L', NULL, 12, 'Actif'),
  ('p140', 'NGUIMALE', 'Mathieu', 'Jardinier à la Présidence', 'Décisionnaire', '101109Z', NULL, 12, 'Actif'),
  ('p141', 'GODAME', 'Thèrèse', 'Fille de Salle à la Présidence', 'Commis Principal d’Administration', '101039C', NULL, 12, 'Actif'),
  ('p142', 'KORONDJI', 'Hubert', 'Buandier à la Présidence', 'Décisionnaire', '11310X', NULL, 12, 'Actif'),
  ('p143', 'SEMBONA', 'Alfred', 'CB , Bunderie', 'Commis Principal d’Administration', '12800R', 'C2', 12, 'Actif'),
  ('p144', 'ZENGOUA', 'Atoine', 'Buandier à la Présidence', 'Commis Principal d’Administration', '101082F', 'C1', 12, 'Actif'),
  ('p145', 'DURANDEAU', 'Euloge', 'Maître d''hôtel à la Présidence', 'Agent d''exploitation', '10015F', 'C1', 12, 'Actif'),
  ('p146', 'VOLIKPIAN', 'Aimé', 'Chauffeur Intendante à la Pr', NULL, NULL, NULL, 12, 'Actif'),
  ('p147', 'PANI', 'Salvador', 'Maître d''hôtel à la Présidence', 'Décisionnaire', '1010074F', NULL, 12, 'Actif'),
  ('p148', 'GURENGAYE', 'Aurelie', 'CB Restauration à la Pr.', 'Décisionnaire', NULL, NULL, 12, 'Actif'),
  ('p149', 'NGOUPANDE', 'Mélanie', 'Cuisinière à la Pr.', 'Comis Principal', '10113P', NULL, 12, 'Actif'),
  ('p150', 'YAONDO', 'Cynthia', 'Cuisinière à la Pr.', 'Attachée Principal', '101081E', 'B1', 12, 'Actif'),
  ('p151', 'MALEYOMBO', 'Christella', 'Fille de Salle à la Présidence', 'Décisionnaire', '100736T', NULL, 12, 'Actif'),
  ('p152', 'NGANA', 'L', 'Hôtesse à la Présidence', 'Laura', NULL, NULL, 12, 'Actif'),
  ('p153', 'KOSSI', 'Aubin', 'Jardinier à la Présidence', 'Décisionnaire', '101073E', NULL, 12, 'Actif'),
  ('p154', 'NAMBOKINENA DEME', 'Lamine', 'Jardinier à la Présidence', 'Décisionnaire', '101100P', NULL, 12, 'Actif'),
  ('p155', 'NGANA', 'Patrice', 'Garcon de Salle du PR', 'Décisionnaire', NULL, NULL, 12, 'Actif'),
  ('p156', 'SOMA', 'Thibault', 'Jardinier à la Présidence', 'Décisionnaire', '101057E', NULL, 12, 'Actif'),
  ('p157', 'GAZALIMA', 'Isac', 'Peintre à la Pr.', 'Décisionnaire', '101053A', NULL, 12, 'Actif'),
  ('p158', 'SONNY SONIA', 'Nina', 'Chef de Bureau', 'Secretaire d''Administration', '10097H', NULL, 12, 'Actif'),
  ('p159', 'KPEATI', 'Bernadette', 'Fille de Salle à la Présidence', 'Décisionnaire', '100000G', NULL, 12, 'Actif'),
  ('p160', 'ZOUMANDJI', 'Sitipeu', 'Maintenencier', 'Décisionnaire', NULL, NULL, 12, 'Actif'),
  ('p161', 'MONGUE', 'Rock', 'Gardien', 'Décisionnaire', NULL, NULL, 12, 'Actif'),
  ('p162', 'YANGAKOLA', 'Francis', 'Gardien', 'Décisionnaire', NULL, NULL, 12, 'Actif'),
  ('p163', 'BIRROT', 'Patrick', 'Jardinier à la Présidence', 'Décisionnaire', NULL, NULL, 12, 'Actif'),
  ('p164', 'BEHOROU NDOMAN', 'Judicael Martial', 'Chef de Service du Personnel', 'Greffier en Chef', '40833N', 'B1', 13, 'Actif'),
  ('p165', 'ELIE', 'Mireille Dorothée', 'Chef de Bureau du Secretairiat Commun', 'Secrétaire d''Administration', '10098J', 'A3', 13, 'Actif'),
  ('p166', 'KOMIDOMGBA', 'Dominique', 'Planton', 'Décisionnaire', '10.293U', NULL, 13, 'Actif'),
  ('p167', 'SEMBONA', 'Fidèle', 'en attente d''affectation', 'Administreur Civ', '12782G', 'A1', 13, 'Actif'),
  ('p168', 'MANKOMOKOÏNA', 'Irène', 'Secretaire', 'Sécretaire D''Admi', '12790G', 'C1', 13, 'Actif'),
  ('p169', 'KONZAPA', 'Josiane Charlotte', 'Attente d''affectetion', 'Attaché d''aministration', '101045A', 'B1', 13, 'Actif'),
  ('p170', 'MAMOUR MAKIM', 'Natidia', 'Attente d''affectetion', 'Commis Principal d’Administration', '101038B', 'C2', 13, 'Actif'),
  ('p171', 'OUABIRO', 'Edvige', 'Directrice', 'Inspecteur du Trsor', '53365U', 'A1', 14, 'Actif'),
  ('p172', 'POUNENDJI', 'Prospert', 'Chef de service', 'Technicien Superieur des Tp', '12646Z', 'B1', 14, 'Actif'),
  ('p173', 'ABEZOUA SEREMALE', 'née Béatrice', 'Chef de Service du Secrétariat', 'Agent d''exploitation', '10237A', 'B1', 14, 'Actif'),
  ('p174', 'NGANAFIO', 'Marlaine Judith', 'Scrétaire', 'Admin Adjoint', '30301C', 'A2', 14, 'Actif'),
  ('p175', 'GRENGOU ORE', 'nnée carole', 'Secretaire', 'Administrateur Civ Adj', '101016V', 'A2', 14, 'Actif'),
  ('p176', 'KOYAMOZIALO TAGBIA', 'Josepha', 'Fille de Salle à la Présidence', 'Attache d''administration', '101069J', 'B1', 14, 'Actif'),
  ('p177', 'DOUMSOU', 'Georges', 'Chef de Bureau des engagements', 'Administrateur Civil', '15210M', 'A1', 14, 'Actif'),
  ('p178', 'KEMO', 'Jean Christophe Médar', 'Directeur du Parc Auto', 'Commandant', NULL, NULL, 15, 'Actif'),
  ('p179', 'CAMARA', 'Carym', 'Chef de Bureau d''expertise', 'Ouvrier Qualifié des Travaux Publics', '10241X', 'B2', 15, 'Actif'),
  ('p180', 'MBISSIVOLA', 'Olga', 'Chef de Bureau de la Gestion des Pièces', 'Sécretaire D''Admi', '10332P', 'C1', 15, 'Actif'),
  ('p181', 'KONGBO SOICLENDJI', 'Roy Rufin', 'Chauffeur', 'Ouvrier des Travaux Publics', '10183E', 'C2', 15, 'Actif'),
  ('p182', 'NAMGBEI', 'Siméon', 'Chauffeur', 'Ouvrier des TP', '10243Z', 'C2', 15, 'Actif'),
  ('p183', 'SAMANY POIKOTA', 'Cythia', 'Cheg de Bureau', 'Administrateur Civ Adj', '101043Y', 'A2', 15, 'Actif'),
  ('p184', 'SAKO', 'Martial Gervain', 'Chauffeur', 'Technicien Superieur des TP', '34447N', 'A3', 15, 'Actif'),
  ('p185', 'SEMTEM BONGUENDE', 'Bienvenu', 'Chauffeur', 'Ouvrier des TP', NULL, 'C1', 15, 'Actif'),
  ('p186', 'TEMBLA', 'Augustin', 'Chauffeur', 'HORS STATUT', '11969J', 'C1', 15, 'Actif'),
  ('p187', 'MONGOPE', 'Thomas', 'Chauffeur', 'Attaché d''Admi', '10214U', 'B1', 15, 'Actif'),
  ('p188', 'NGABINA GBAKON', 'Thierry', 'Chauffeur', 'Décisionnaire', '10185R', NULL, 15, 'Actif'),
  ('p189', 'MONKOZA', 'Jean Bosco', 'Chauffeur', 'Décisionnaire', '10390W', NULL, 15, 'Actif'),
  ('p190', 'KANDA', 'Parfait', 'Chauffeur', 'Décisionnaire', '87418T', NULL, 15, 'Actif'),
  ('p191', 'MAVATA', 'Fleuri Jean de Dieu', 'Chauffeur', 'Décisionnaire', '87958H', NULL, 15, 'Actif'),
  ('p192', 'PASSARAMY', 'Chislain', 'Chauffeur', 'Décisionnaire', '10233M', NULL, 15, 'Actif'),
  ('p193', 'KAKOBANGA', 'Igor', 'Chauffeur', 'Attaché d''Admi', '97039R', 'B1', 15, 'Actif'),
  ('p194', 'KOSSINA', 'Gabriel', NULL, 'Décisionnaire', NULL, NULL, 15, 'Actif'),
  ('p195', 'DONDOLET', 'Dénis', 'Chauffeur', 'Hors staut', '10061V', NULL, 15, 'Actif'),
  ('p196', 'BALEGBONDO', 'Donatien Thibaut', 'Chauffeur', 'Décisionnaire', NULL, NULL, 15, 'Actif'),
  ('p197', 'DEBA SAM', 'Clet Roméo', 'Chauffeur', 'Ouvrier des TP', '11298U', 'C1', 15, 'Actif'),
  ('p198', 'KPEFIO', 'Laurent', 'Chauffeur', 'Décisionnaire', '101063C', NULL, 15, 'Actif'),
  ('p199', 'SANG BAILLE', 'Samuel', 'Chauffeur', 'Décisionnaire', '101064D', NULL, 15, 'Actif'),
  ('p200', 'VOLIKPIAN', 'Aimé', 'Chauffeur', 'Décisionnaire', NULL, NULL, 15, 'Actif'),
  ('p201', 'MAKA KPIOSSA', 'Chislain', 'Chauffeur', 'Décisionnaire', '101070B', NULL, 15, 'Actif'),
  ('p202', 'GUIMALET', 'Thibaut', 'Chauffeur', 'Décisionnaire', '101071C', NULL, 15, 'Actif'),
  ('p203', 'DAMBAKIZI SIMAKOTO', 'Bruno', 'Chauffeur', 'Décisionnaire', NULL, NULL, 15, 'Actif'),
  ('p204', 'DES ZOUMANDJI', 'Etoile', 'Chauffeur', 'Décisionnaire', NULL, NULL, 15, 'Actif'),
  ('p205', 'AMADOU-DENGOYANA', 'Hugues', 'Chauffeur', 'Décisionnaire', '101176L', NULL, 15, 'Actif'),
  ('p206', 'FEIDANGAMO', 'Bienvenu', 'Chauffeur', 'Ouvrier des TP', '69339Y', 'C1', 15, 'Actif'),
  ('p207', 'SINTE', 'Geoffrey', 'Chauffeur', 'Décisionnaire', '101091G', NULL, 15, 'Actif'),
  ('p208', 'NDABA', 'Faustin Cyrille', 'Chauffeur', NULL, NULL, NULL, 15, 'Actif'),
  ('p209', 'YANDOKA', 'Félix', 'Chauffeur', NULL, NULL, NULL, 15, 'Actif'),
  ('p210', 'KONGAÏ', 'Thimoté', 'Chauffeur', 'Décisionnaire', NULL, NULL, 15, 'Actif'),
  ('p211', 'KOINGAI', 'Timothée', 'Chauffeur', NULL, NULL, NULL, 15, 'Actif'),
  ('p212', 'KONGBO SOICLENDJI', 'Roy Rufin', 'Chauffeur', 'Ouvrier des TP', '10183E', 'C1', 15, 'Actif'),
  ('p213', 'FARABONA', 'Lilian Nicolas', 'Chef de Service des Archives', 'Administrateur Civil Adjoint', '10036U', 'A2', 16, 'Actif'),
  ('p214', 'IGNAO', 'Olga Judith', 'Chef de Service de la Bibliothèque', 'Administrateur Cicil', '67680A', 'A1', 16, 'Actif'),
  ('p215', 'NINPINGO', 'Léon', 'Chef de Service de la Documentation', 'Attaché d’Administration', '10268J', 'A2', 16, 'Actif'),
  ('p216', 'DEMANGUE', 'Félicité', 'Chef de Service Technique', 'Hors Statut', '10156M', NULL, 16, 'Actif'),
  ('p217', 'KONDJIANE', 'Prosper Evariste', 'Chef de Bureau Spécialisé', 'Secrétaire d’Administration', '10220S', 'C1', 16, 'Actif'),
  ('p218', 'DANMONA', 'Benoit', 'Chef de Bureau des Archives', 'Commis Principal d’Administration', '10216W', 'C2', 16, 'Actif'),
  ('p219', 'KARAOUA', 'Freedman', 'Secretaire', 'Attaché d''Admi', '101056D', 'B1', 16, 'Actif'),
  ('p220', 'KOSSI IKOUNDOU', 'Murielle', 'Secretaire', 'Attachée d''Administration', '101066F', 'B1', 16, 'Actif'),
  ('p221', 'FEIZOURE', 'Nathalie', 'Secrétaire', 'Secrétaire d’Administration', '12787M', 'B2', 16, 'Actif'),
  ('p222', 'MARBOUA', 'Hyppolyte', 'Directeur Général par Interim', 'Admi Cil', '10012K', 'A1', 17, 'Actif'),
  ('p223', 'NGOULOU KENGO', 'Jean Fridolin', 'Directeur', 'Admi Civi', '11106V', 'A3', 18, 'Actif'),
  ('p224', 'ANGA', 'Sephore Josiane', 'Chef de Service', 'Attachée Principal', '10030M', 'B1', 18, 'Actif'),
  ('p225', 'MAZOUMOKO', 'Estelle', 'Chef de Service Reportage', 'Admi Civ Adjoint', '20391S', 'A2', 18, 'Actif'),
  ('p226', 'TEVENET', 'Max Thierry', 'Directeur', 'Admi Civ', '20580G', 'A1', 19, 'Actif'),
  ('p227', 'SEBOUT GBETE', 'Freddy', 'Chef de Service Audi visuelle', 'Ing', NULL, 'A1', 19, 'Actif'),
  ('p228', 'NGOLLAN BISSADE', 'Ange', 'Chef de service Photographie', 'Hors Statut', '10368T', NULL, 19, 'Actif'),
  ('p229', 'DURENDEAU', 'Clovis Prestige', 'Chef de service', 'Attaché de Pressse', '10043T', 'B3', 19, 'Actif'),
  ('p230', 'VIDAKPA', 'Junior Adonis', 'Directeur', 'Adm Cil', '10022M', 'A1', 20, 'Actif'),
  ('p231', 'KOGNONGUE', 'Dieu Béni', 'Chef de Service Technique', 'Admi Cil Adjoint', '10024P', 'A1', 20, 'Actif'),
  ('p232', 'KASSIA YAWORO', 'Martial', 'Service Maintenance', 'Hors Statut', '101050P', NULL, 20, 'Actif'),
  ('p233', 'YONDO ABDON', 'Stéphanne', 'C.S de gestion de materiels', 'Hors Statut', '10035T', NULL, 20, 'Actif'),
  ('p234', 'MOUSSA', 'Deudonné', 'Directeutr', 'Administrateur Civil', '20530Y', 'A1', 21, 'Actif'),
  ('p235', 'SEDO', 'Edwige', 'C.S Presse Ecrite', 'Admi Cil', '65046X', 'A1', 21, 'Actif'),
  ('p236', 'KPADEMONA', 'Frddy Bienvenu', 'C.S en Ligne', 'Attaché de l''admis', '11113U', 'A3', 21, 'Actif'),
  ('p237', 'TINGOU', 'Aggée', 'C.S Analyse de la Presse', 'Admi Civ', '100026S', 'A1', 21, 'Actif'),
  ('p238', 'ABDERRASSOUL', 'Seidou', 'Directeur', 'Administrateur Civ', '20879J', 'A1', 22, 'Actif'),
  ('p239', 'NDENGOU', 'Avila', 'Chef de service du Secretariat', 'Hors staut', '101059G', NULL, 22, 'Actif'),
  ('p240', 'NGAISSET', 'Mathieu', 'CB', 'Attaché d''Admi', '200304C', 'B1', 22, 'Actif'),
  ('p241', 'SIAO NDAKALA', 'Barbara', 'Secerétaire', 'Décisionnaire', '101062B', NULL, 22, 'Actif'),
  ('p242', 'WOTHO', 'Polydore Christopher', 'Chef de Service', 'Attaché d''Admi', '10038W', 'B1', 22, 'Actif'),
  ('p243', 'PKAWIRENA', 'Anicet Achile', 'Chargé de Mssion', 'Lieutenant Colonel', NULL, NULL, 23, 'Actif'),
  ('p244', 'DOMO SARAGBA', 'Paul', 'Directeur des Ordre Nationaux', 'Lieutenant', NULL, NULL, 23, 'Actif'),
  ('p245', 'BEANGAÏ', 'Natacha Christelle', 'Chef de Service', 'Controleur Princ', '53752C', NULL, 23, 'Actif'),
  ('p246', 'NAMBEAM', 'Léonie Euphrasie', 'Chef de Bureau', 'Attachée Principal', '11286L', NULL, 23, 'Actif'),
  ('p247', 'WANAM', 'Stella', 'Chef de Bureau', 'Attachée Principal', '10221T', NULL, 23, 'Actif'),
  ('p248', 'BOYCAMBO', 'Aubiège Irma', 'Secerétaire', 'Attachée Principal', '101046B', NULL, 23, 'Actif'),
  ('p249', 'OUADJOKO YANIKOUZOU', 'Floeant', 'Planton', 'Attaché d''Admi', '101067G', NULL, 23, 'Actif'),
  ('p250', 'BADO KOGBAYA', 'Josiane', 'Chef de Bureau du Secrétariat Commun', 'Secrétaire', '10994J', 'C1', 24, 'Actif'),
  ('p251', 'MBISSIVOLA', 'Olga Giselle', 'Chef de Bureau', 'Attachée Principal', NULL, NULL, 24, 'Actif'),
  ('p252', 'BONNET MOUBET', 'Marie Jeanne', 'Secretaire', 'Attachée Principal', '101037A', 'A3', 24, 'Actif'),
  ('p253', 'KOYAKPEGON', 'Germain', 'Chef de Bureau Informatique', 'Informaticien', '15487R', 'B3', 24, 'Actif'),
  ('p254', 'PAGONE', 'Florence', 'Chef de Service', 'Sécrétaire', '98095J', 'C1', 25, 'Actif'),
  ('p255', 'GONINAM', 'Gilberte', 'Chef de Service de Santé infantile', 'Sage Femme', '75489A', 'B1', 26, 'Actif'),
  ('p256', 'NGAMATOU', 'Dieudonné', 'Sentinelle', 'Décisionnaire', '10315M', NULL, 27, 'Actif'),
  ('p257', 'RHUN-TAHIRI', 'Guy Oscar', 'Secrétaire Particulière', 'Hors Statut', NULL, NULL, 28, 'Actif'),
  ('p258', 'MOUSSA LABE DAHAMONGO', 'D.', '1er Coordonateur', 'Hors Statut', '10231M', NULL, 29, 'Actif'),
  ('p259', 'GAWAKA', 'Noel Evariste', '2ème Cordonnateur', 'Hors Statut', '83686A', NULL, 29, 'Actif'),
  ('p260', 'GONISSERE', 'Jean Privat', 'Section Technique', 'Controleur G des Fin', '52254B', 'A1', 29, 'Actif'),
  ('p261', 'MOKAMANEDE YASSIMBETI', 'Pierrete', 'Affaire Générale', 'Hors Statut', '51941Z', NULL, 29, 'Actif'),
  ('p262', 'LANZOU', 'Rufin Téophile', '2 ème affaire Générale', 'Controleur G des Fin', '30064J', 'A1', 29, 'Actif'),
  ('p263', 'ZOUMBETI', 'Samuel Stanislas', 'Section I.C.A.C.E', 'Inpecteur Prin des Douanes', '12701N', 'A1', 29, 'Actif'),
  ('p264', 'ZALAOUNE-KOLO', 'Jean Gabin', 'Section I.C.A.C.E', 'Insp des imôpts', '52294S', 'A1', 29, 'Actif'),
  ('p265', 'KALANDA', 'Maryse Théodora', 'Section I.V.O.P.S', 'Admin Civ', '65259C', 'A1', 29, 'Actif'),
  ('p266', 'KOLINGBA', 'Guy Rufin Simplice', 'Section I.C.A.T.C.L', NULL, NULL, NULL, 29, 'Actif'),
  ('p267', 'BASSALA YAPENDE', 'née Gisèle', 'Section I.C.A.T.C.L', 'Ing des Aux et Foret', '69957V', 'A1', 29, 'Actif'),
  ('p268', 'MOUSSA', 'André', 'Section I.C.C', 'Hors Statut', '800084Z', NULL, 29, 'Actif'),
  ('p269', 'DAMOSSA', 'Janin Nazaire', 'Section C/S.A.D.A.J', 'Admin Civ', '30639C', 'A1', 29, 'Actif'),
  ('p270', 'GUEREKPEDOU', 'Jean Piérre', 'Section S.A.D.A.J', 'Hors Statut', '10460V', NULL, 29, 'Actif'),
  ('p271', 'ZOUAKA', 'Daniel', 'Section Technique', NULL, NULL, NULL, 29, 'Actif'),
  ('p272', 'ISIMA', 'Arielle Néfertiti', 'Directrice de Protocole', NULL, NULL, NULL, 30, 'Actif'),
  ('p273', 'RHUAN TAHIRI', 'Guy', 'Chef de service Secrétariat P', 'Adjoint Tech de l''informatique', '69551A', 'A3', 30, 'Actif'),
  ('p274', 'NGANADOKA', 'Pierre', 'Chef de Service Financier', 'Hors Statut', '11642A', NULL, 30, 'Actif'),
  ('p275', 'MASSET', 'Daniel', 'Chef de Serice Finanacier', 'Insp dev Tresor', '52815V', 'A1', 30, 'Actif'),
  ('p276', 'L/T YAFONDO', 'Dieudonne', 'Lieutenant', NULL, NULL, NULL, 30, 'Actif'),
  ('p277', 'LOKLE', 'Lydie', 'Attachée de Protocole', 'Admin Civ', '30491A', 'A1', 30, 'Actif'),
  ('p278', 'KOULA', 'Syjvie Marlyne', 'Chef de bureau SP', 'Admin Civ Adjiont', '55304V', 'A2', 30, 'Actif'),
  ('p279', 'BIMBO NDAMBOUANMA', 'Germine', 'Chef de Bureau du C.I', 'Admin Civ Adjiont', '55311W', 'A2', 30, 'Actif'),
  ('p280', 'L/T YALA KATE', 'Joel Ferdin', 'Lieutenant', NULL, NULL, NULL, 30, 'Actif'),
  ('p281', 'ADJT SENWEI', 'Evard', 'Adjt Chef', NULL, NULL, NULL, 30, 'Actif'),
  ('p282', 'C.C ZAHOLO', 'Romain', 'Aide de Camp', NULL, NULL, NULL, 30, 'Actif'),
  ('p283', 'NGOMA MOENGUE', 'Véronique', 'Aide de Camp', 'Attachée Principal', '20578B', 'A3', 30, 'Actif'),
  ('p284', 'MBILIKEU', 'Judith', 'Sécrétaire', 'Adm Civ Adj', '10248E', 'A2', 30, 'Actif'),
  ('p285', 'NBAÏNDO DEHORO', 'Esther', 'Sécrétaire', 'Attachée Principal', '20469X', 'A3', 30, 'Actif'),
  ('p286', 'NAZI', 'Appolinaire', 'Chauffeur', NULL, NULL, NULL, 30, 'Actif'),
  ('p287', 'KOYASSOUNGOU', 'Parfait', 'Plonton', NULL, NULL, NULL, 30, 'Actif'),
  ('p288', 'DENAMGUERE', 'Raymond', 'Plonton', 'Attachée Principal', '11009C', NULL, 30, 'Actif'),
  ('p289', 'GBAMASSOU', NULL, 'Jardiner', NULL, NULL, NULL, 30, 'Actif'),
  ('p290', 'NAZI', 'Appolinaire', 'Chauffeur', 'Hors Statut', '10349R', NULL, 30, 'Actif'),
  ('p291', 'MALIBANGAR', NULL, 'Chargé de Mission matière du projet', 'hors Statut', '47379E', NULL, 31, 'Actif'),
  ('p292', 'GUINET', 'Natacha Judith', 'Chargé de Mission Jurique et du Genre', 'Magistrat', '40215Y', NULL, 31, 'Actif'),
  ('p293', 'MBALA-TE-GUERET', NULL, 'Assistant Administratif', 'Commandant', NULL, NULL, 31, 'Actif'),
  ('p294', 'OUANGBANGA', 'Boris', 'Assistant Communication', NULL, NULL, NULL, 31, 'Actif'),
  ('p295', 'ROÏMALE', NULL, 'Chef de Bureau Informatique', NULL, NULL, NULL, 31, 'Actif'),
  ('p296', 'DONGOMANDJI', NULL, 'Cheffe du Courier', 'Sergent', NULL, NULL, 31, 'Actif'),
  ('p297', 'MAZANGUE', 'Jules César', 'Chargé de Mission', 'hors Statut', '10072M', NULL, 32, 'Actif'),
  ('p298', 'OUAGRAMALE', 'Bernard', 'Chargé de Mission', 'Hors status', NULL, NULL, 32, 'Actif'),
  ('p299', 'BOUKARY', 'Adèle', 'Assistante Administrative', 'Administeur Civ Adjointe', '100500K', NULL, 32, 'Actif'),
  ('p300', 'BOUBA', 'Jérôme', 'Sécrétaire Général', 'Gnéral de Division', NULL, NULL, 33, 'Actif'),
  ('p301', 'KOTALY', 'Julien', '1ER Assistant', 'GOL', NULL, NULL, 33, 'Actif'),
  ('p302', 'LINGUI', 'Jean Marie', '2eme Assistant', 'Lcol', NULL, NULL, 33, 'Actif'),
  ('p303', 'ZANGO', 'Barthélemy R', 'Chef de Service Sec Particulier', 'LT', NULL, NULL, 33, 'Actif'),
  ('p304', 'DONDRA', 'Léa', 'Chef de Bureau Informatique', 'LT', NULL, NULL, 33, 'Actif'),
  ('p305', 'BOUEBEDA', 'Nicole', 'Chef de Bureau Courrier', 'Persoonel Civil', NULL, NULL, 33, 'Actif'),
  ('p306', 'LOTARA', 'Mamadou', 'Aide de Camp', 'adjudant', NULL, NULL, 33, 'Actif'),
  ('p307', 'YAPENDE', 'Yanick', 'Chauf de Commandement', 'Sergent', NULL, NULL, 33, 'Actif'),
  ('p308', 'MBONGUI', 'Alderic', 'Planton', 'Caporal Chef', NULL, NULL, 33, 'Actif'),
  ('p309', 'MOKOBANGO', 'Florida', 'Fille de Salle', 'Caporal Chef', NULL, NULL, 33, 'Actif'),
  ('p310', 'BALENE', 'Charlotte', 'Fille de Salle', '2éme Classe', NULL, NULL, 33, 'Actif'),
  ('p311', 'MADOUSSIRI', 'Marie Noelle', 'Directrise du Secretariat', 'Administraeur Adjoint', '10486X', 'A2', 34, 'Actif'),
  ('p312', 'PEGUIDA', 'Lonne Ferry Shimer', 'Directeur de Protocole', 'Admin Civ Adjoint', '100722L', 'A2', 34, 'Actif'),
  ('p313', 'NODJITOLOUM', 'Oscar', 'Chef de service', 'Attachée Principale', '100723M', 'B1', 34, 'Actif'),
  ('p314', 'MONGONOU', 'Rédrick', 'Chargé de Mission', 'Administrateur Civ', NULL, NULL, 35, 'Actif'),
  ('p315', 'TOUATENA SIMANDA', 'Judicael', 'Chargé de Mission', 'Administrateur Civ', NULL, NULL, 35, 'Actif'),
  ('p316', 'GUIAKOUZOU KEKENE LOMBE', 'née Tricilia', 'Chargé de Mission', 'Journaliste', NULL, NULL, 35, 'Actif'),
  ('p317', 'RANGBA SONGO', 'Férdérick', 'Assistant Administratif', 'Sous lieutenent', NULL, NULL, 35, 'Actif'),
  ('p318', 'WINZAO', 'Marie Yvette', 'Assistant Administratif', 'Attachée Principale', NULL, NULL, 35, 'Actif'),
  ('p319', 'BELEMA SINGAGNA', 'Léandre Marcelino', 'Directeur de Communication', NULL, NULL, NULL, 36, 'Actif'),
  ('p320', 'GBAMOU ENJIZAGO', 'Théophile', 'Chargé de Mision', 'Statiscien', NULL, NULL, 36, 'Actif'),
  ('p321', 'NGAWEN', 'Germain', 'Chargé de Msiion', 'Hors Statut', NULL, NULL, 36, 'Actif'),
  ('p322', 'PODOUEMA', 'Agnès', 'Chef de serviec', 'Hors Staut', NULL, NULL, 36, 'Actif'),
  ('p323', 'GAKARA', 'Virginie', 'Techicienne udio Visuelle', 'Hors Statut', NULL, NULL, 36, 'Actif'),
  ('p324', 'BELEMA', 'Luciènne Thérèse', 'Hôtesse', 'Décisionnaire', NULL, NULL, 36, 'Actif'),
  ('p325', 'IDAKPA', 'Leticia Charlène', 'Fille de Salle', 'Décisionnaire', NULL, NULL, 36, 'Actif'),
  ('p326', 'MAGBA-IBANGA', 'Dian Mahalia', 'Coiffeuse', 'Décisionnaire', NULL, NULL, 36, 'Actif'),
  ('p327', 'MALEOMBHO', 'Bintou', 'Agent de Protocole', 'Décisionnaire', NULL, NULL, 36, 'Actif'),
  ('p328', 'MOUTCHOUBOUTCHOU', 'Benoit Jésus', 'Chauffeur', 'Décisionnaire', NULL, NULL, 36, 'Actif'),
  ('p329', 'NGAWEN BASSAE', 'Finder', 'Planton', 'Décisionnaire', NULL, NULL, 36, 'Actif'),
  ('p330', 'GAÏGBAN YEMALAYEN', 'Rose Mystique', 'CS du Personnel', 'Décisionnaire', NULL, NULL, 36, 'Actif'),
  ('p331', 'SOBANGO', 'David', 'Chauffeur', 'Décisionnaire', NULL, NULL, 36, 'Actif'),
  ('p332', 'SOKAMBI-ZOUTA', 'Marie Jaculine', 'Dirctrice de Cabinet', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p333', 'BAMA', 'Etinne Tounsol', 'CM en matière d''éducation et d''élevage', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p334', 'TCHEKOE MTCHINGOU', 'Pulchri Nathalie Née', 'CM en matière d''éducation et de Protection de l''enfant', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p335', 'KOSSIMATCHI', 'Gaston', 'Directeur en matière de Santé (VIH/SIDA) et environnment', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p336', 'FEINDIRO', 'Désiré Arsène', 'Dircteu de communication/Presse', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p337', 'NGLLO-MANGOUBOU-ZONI', 'Romanov Chanclin Styj', 'Dircteur Admin et du matériel', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p338', 'DJONO-INDA', 'Chancela Ursil Reine', 'CS. Admin et Financier', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p339', 'MOUNDAYEN', 'Flavien Saturnin', 'CS Informatique', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p340', 'GBAGUENE', 'François', 'CS de la logistique', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p341', 'NDAOS', 'Nicola Hyacinthe', 'CS de Suivi-Evaluation', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p342', 'PAYOMBO', 'Rose de Lima', 'CS. En matière de Comptabilité', NULL, NULL, NULL, 37, 'Actif'),
  ('p343', 'MAMBA', 'Nadine', 'Attachée Protocole', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p344', 'DIABA', 'Aline', 'Attaché de Protocole', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p345', 'GUESS-BABET', 'Rodrigue Freddy', 'Attaché de Protocole particulier', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p346', 'ALIGNE', 'Mlle.Arlette Marie Gabrielle', 'Secrétaire Particulière', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p347', 'NGAIGBINO-BEOROFEI', 'Aubin', 'Attaché de Presse', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p348', 'KAÏBE', 'Nathalie', 'Fille d''acueille', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p349', 'NDELAKOHOU', 'Synthiche Elsi Yébets Vincya', 'Fille d''acueille', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p350', 'ALAOU DANIOUA', 'Ann Carine', 'Fille d''acueille', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p351', 'GUIGAZA NGATE', 'Guy Bertrnd', 'Huissier', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p352', 'YOMBI', 'Vanssa Adriènne Stève', 'Secrétaire', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p353', 'NZOVARA-MOUNGA', 'Carole Gille', 'Technicienne de surface', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p354', 'PASSARAMY', 'Ghislain', 'Chauffeur de Commandemant de la Première Dame', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p355', 'BALEGBONDO', 'Enguet Thibaut Donatien', 'Chauffeur', 'Hors Statut', NULL, NULL, 37, 'Actif'),
  ('p356', 'ZIAMBINI', 'Freddy Emers Cyr', 'Chauffeur', NULL, NULL, NULL, 37, 'Actif'),
  ('p357', 'SAMARANDJI', 'Gaetan', 'Conseiller', NULL, NULL, NULL, 38, 'Actif'),
  ('p358', 'MBENDA', 'Jean', 'Chargé de Mission', NULL, NULL, NULL, 38, 'Actif'),
  ('p359', 'EREDOUPE', 'Berthel', 'Chargé de Mission', NULL, NULL, NULL, 38, 'Actif'),
  ('p360', 'MAYE ISSAMAR', 'Hubert Cathérine', 'Assistante Admin', NULL, '11068G', 'A1', 38, 'Actif'),
  ('p361', 'GOUENZA', 'Princia de l''Aurore', 'Directrice du matériel et de la logistique', 'Administrateur Civ', '101035Y', 'A1', 38, 'Actif'),
  ('p362', 'OUANDE', 'Hervé', 'CS du personnel', 'Attaché d''Administ', '10127W', 'B1', 38, 'Actif'),
  ('p363', 'NOZIEL', 'Bénédicte', 'CS Secrétariat commun', NULL, '10099K', NULL, 38, 'Actif'),
  ('p364', 'PAKOLO-MNKENG', 'Momie Monique Evodie', 'CS de bla Communication', 'Administrateur Civ', '10047X', 'A1', 38, 'Actif'),
  ('p365', 'WATO', 'Assuérus Aggée', 'CS du Multimdédia', 'Ingenieur en Inf', '10065Z', 'A1', 38, 'Actif'),
  ('p366', 'MENTELE-MIENATCHIA', 'Casimira Borisca Victoria Amona', 'CS Materiel et de l''Equipement', 'Hors Statut', '10107S', NULL, 38, 'Actif'),
  ('p367', 'FALI', 'Michel', 'CS de la Statistique', 'Admi Civ Adjiont', '10093D', 'A2', 38, 'Actif'),
  ('p368', 'NADOU-YAZOLO', 'Junia Miguel', 'CS de la Digitlisation', 'Ing Trav en Ifor', '10058A', 'A1', 38, 'Actif'),
  ('p369', 'NAMBANA', 'Cyrille Aristide', 'CS Administratif (Région des Plateaux)', 'Admi Civ', '10144X', 'A1', 38, 'Actif'),
  ('p370', 'NGOÏTA DOUCLE LONAWE', 'Née Kathleen Charlotte Yvette', 'CS Administratif (Région de l''Equateur)', 'Attaché d''Administ', '10158D', 'B1', 38, 'Actif'),
  ('p371', 'NAMSERE', 'Modeste', 'CS de Communication et Sensibilisation (Région Equateur)', 'Attaché d''Administ', '10160X', 'B1', 38, 'Actif'),
  ('p372', 'DETAR', 'Placide Flore', 'CS Administrative (Région Yade)', 'Administrateur Civ', '10146Z', 'A1', 38, 'Actif'),
  ('p373', 'DOUYA', 'Jymmi', 'CS Communication et Sensibilisation (Région du Yade)', 'Adm civ Adj', '10162Z', 'A2', 38, 'Actif'),
  ('p374', 'GAMBI', 'Axelle Carine', 'CS Administratif (Région des Bas-Oubangui)', 'Attaché d''Administ', '10046W', 'B1', 38, 'Actif'),
  ('p375', 'MONDEKPE', 'Lydiana Henrica', 'CS Administratif (Région des Kagas)', 'Attaché d''Administ', '10149C', 'B1', 38, 'Actif'),
  ('p376', 'GUIANGOU ZOUBINGUI', 'Gustave Firmin Caleb', 'CS Communication et Sensibilisation (Région des Kaga)', 'Hors Statut', '10182D', NULL, 38, 'Actif'),
  ('p377', 'MALEPOU', 'Joseph Ben', 'CS Communication et Sensibilisation (Région du Ferti)', 'Attaché d''Administ', '10171A', 'B1', 38, 'Actif'),
  ('p378', 'TCHOKOTE', 'Jean Robert', 'CS Administratif (Région du Haut-Oubangui)', 'Prof Adj ducation', '10087F', 'B1', 38, 'Actif'),
  ('p379', 'IMAGO-WAMBI', 'Constance', 'CS Communication et Sensibilisation (Région du Haut -Oubangui)', 'Adm civ Adj', '11088L', 'A2', 38, 'Actif'),
  ('p380', 'WILIKON', 'Yvon', 'Directeur Régional', 'Adm civ Adj', '100986K', 'A2', 38, 'Actif'),
  ('p381', 'KONGBO', 'Sylvestre', 'C S comptabilite', 'Tech Dev Rural', '10101K', 'B1', 38, 'Actif'),
  ('p382', 'YANAPOULE', 'Ella', 'CS Communication', 'Administrateur Civ', '10069D', 'A2', 38, 'Actif'),
  ('p383', 'HASANE', 'Mahamat', 'Directeur', 'Ing Statistique', '800037S', 'A1', 38, 'Actif'),
  ('p384', 'TONGAI', 'Benjamin', 'Directeur Régional', 'Administrateur Civ', '10123S', 'A1', 38, 'Actif'),
  ('p385', 'LACKY', 'Arsene', NULL, 'Commissaire de Poli', '30158W', NULL, 38, 'Actif'),
  ('p386', 'WOLODOPO', 'Léa Evelyne', 'CS du Secrétariat Particulier', 'Adj Tehn Infor', '69519A', NULL, 39, 'Actif'),
  ('p387', 'NGUEREZAPA', 'Richard', 'Chargé de Mission Coordo', 'Hors Statut', '15524C', NULL, 39, 'Actif'),
  ('p388', 'NAM', 'Trimithe', 'EXPERT national', 'Adm Civ', '100662S', NULL, 39, 'Actif'),
  ('p389', 'KOSSIMA', 'Jacob', 'EXPERT national', 'Igne Agro', '69408U', NULL, 39, 'Actif'),
  ('p390', 'GANA YONGODE', 'Parfait Didier', 'Expert National', 'Adm civ', NULL, NULL, 39, 'Actif'),
  ('p391', 'KAMA YEMAWA', 'Jean Bertin', 'Directeur des Ressources', 'Inspe de Travail', NULL, NULL, 39, 'Actif'),
  ('p392', 'MAZANGUE MBOYA', 'Néron Ludovic', 'CS de Gestion des Ressoures Humaines', 'Adj Chef', '98761M', NULL, 39, 'Actif'),
  ('p393', 'GNALIS GUININGBA', 'Sévérine Carine', 'CS de Gestion des Ressoures Financières et Matérielles', 'Adm Civ', '100699F', NULL, 39, 'Actif'),
  ('p394', 'PIOGOSSI MASSOUA', 'Valery', 'CS de la Logistique et des Infrastructures', 'Adm Civ', '1006950B', NULL, 39, 'Actif'),
  ('p395', 'KALA', 'Francis Claver', 'CS de la Communication et des Relations Extérieures', 'Adm Civ', '100696C', NULL, 39, 'Actif'),
  ('p396', 'BAGAZA', 'Bourges Dieu-Suffit', 'CS des Archives et de la Documentation', 'Adm Civ', '101025U', NULL, 39, 'Actif'),
  ('p397', 'PANI', 'Pascal Bienvenu', 'Attaché', 'Adm Civ Adjoint', '100697DS', NULL, 39, 'Actif'),
  ('p398', 'KOSSIMA', 'Jacob', 'Expert National en charge de l''Appui à la Production et à la Commercialisation', 'Ing Agro', '69408U', NULL, 39, 'Actif'),
  ('p399', 'NAM', 'Trinité', 'Expert National en charge de la Formation et de l''Insertion', 'Adm Civ', '100662S', NULL, 39, 'Actif'),
  ('p400', 'GANA YONGODE', 'Parfait Didier', 'Chargé d''Etude et de la Planification', 'Adm Civ', NULL, NULL, 39, 'Actif'),
  ('p401', 'SANGHA', 'Séverin', 'Chargé d''Etude en Matière de Commercialisation et d''Animation Rurale', 'Hors Statut', '100670S', NULL, 39, 'Actif'),
  ('p402', 'LEBEYAKA-ZAKOBE', 'Didier', 'Chargé d''Etude en matière de Formation Professionnelle et de l''Insertion', 'Adm Civ Adjoint', '71594E', NULL, 39, 'Actif'),
  ('p403', 'BANGAMATOMA', 'Jules', 'Chargé d''Etude en matière d''Education Civique', 'Hors Statut', '100671T', NULL, 39, 'Actif'),
  ('p404', 'HAMIDOU GARBOLAUD', 'Edgard', 'Chargé d''Etude en matière de Développement', 'Adm Civ', '100702G', NULL, 39, 'Actif'),
  ('p405', 'BOYMANDJIA', 'Patrick', 'Directeur Régional n°1', 'Ing Agro', NULL, NULL, 39, 'Actif'),
  ('p406', 'SENZONGO', 'Sylvain', 'Directeur Régional n°2', 'Adm Civ', NULL, NULL, 39, 'Actif'),
  ('p407', 'OSSIBOUGNA', 'Guy Turibe', 'Directeur Régional n°3', 'Ing Agro', '60411L', NULL, 39, 'Actif'),
  ('p408', 'ANDJINGBODEPOU', 'Emmanuel Oliviera', 'Directeur Régional n°4', 'Adm Civ', NULL, NULL, 39, 'Actif'),
  ('p409', 'IBRAHIM', 'Didier Florentin', 'Directeur Régional n°6', 'Hors Statut', NULL, NULL, 39, 'Actif'),
  ('p410', 'KAKA', 'Moîse', 'Directeur Régional n°7', 'Adm Civ', NULL, NULL, 39, 'Actif'),
  ('p411', 'ENDJIKESSE', 'Marie Clariss', 'CS de Production Agro-Pastorale', 'Ing Agro', '100730L', NULL, 39, 'Actif'),
  ('p412', 'KONDO-YSIE', 'Régine', 'CS de Commercialisation', 'Adm Civ', '10060L', NULL, 39, 'Actif'),
  ('p413', 'NGATE', 'Raphaella Bernadine', 'CS d''Animation Rurale', 'Admi Civ', NULL, NULL, 39, 'Actif'),
  ('p414', 'YAMBOS GONDOLAS', 'Rostand Gildas', 'CS des Statistiques et des bases de Données', 'Adm Civ', '100668Y', NULL, 39, 'Actif'),
  ('p415', 'MAMADOU NGOUNDE', 'Olga', 'CS d''Orientation', 'Adm Civ', '100700E', NULL, 39, 'Actif'),
  ('p416', 'Flora', 'GUEREKOPIALO-Dibert-Bety', 'CS Psychosocial', 'Tech Sup', '100701F', NULL, 39, 'Actif'),
  ('p417', 'IGAO LEPPA', 'Cathérine', 'CS de Développement Social', 'Cons cult Adjointe', '102830X', NULL, 39, 'Actif'),
  ('p418', 'MONZONGO', 'Donatien', 'CS de Suivi d''Impact Environnemental', 'Tech Sup Eaux et Foret', '69041G', NULL, 39, 'Actif'),
  ('p419', 'Germaine', 'Mme.DEKEZANDJI', 'CS Prectoral de l''OMBELLA M''POKO', 'Horst Statut', '10055K', NULL, 39, 'Actif'),
  ('p420', 'MAVODE BOGBATA', 'Donald Ulrich', 'CS Préfectoral de la LOBAYE', 'Adm Civ', NULL, NULL, 39, 'Actif'),
  ('p421', 'BOGOMO-LESSEBOU', 'Marino Josias', 'CS Prectoral de la NANA-MAMBRE', 'Adm Civ', NULL, NULL, 39, 'Actif'),
  ('p422', 'NDOUVADE DOUTIKOUE', 'Prisca Mathilde', 'CS Préfectoral de la MAMBERE-KADEÏ', 'Adm Civ Adjoint', '100689D', NULL, 39, 'Actif'),
  ('p423', 'HONNET', 'Bruno', 'CS Préfectoral de l''HOUHAM', 'Tech Agri', NULL, NULL, 39, 'Actif'),
  ('p424', 'KOTAMANDJIA', 'Robby', 'CS de la KEMO', 'Hors Statut', NULL, NULL, 39, 'Actif'),
  ('p425', 'SONGO', 'Jacques', 'CS Préfzctoral de MBOMOU', 'Adm Civ', NULL, NULL, 39, 'Actif'),
  ('p426', 'DONGOMBE', 'Léopold', 'CS Préfectoral de la Basse-Kotto', 'Adm Civ', '80658D', NULL, 39, 'Actif'),
  ('p427', 'PARABANA', 'Moïse', 'CS Préfctoral de BAMINGUI-BANGORAN', 'Tech Elevage', NULL, NULL, 39, 'Actif'),
  ('p428', 'SIANGO', 'Nicaise', 'CS Préfectoral de la Haute-Kotto', 'Adm Civ', '100733P', NULL, 39, 'Actif'),
  ('p429', 'ISSENE AMBA', 'Saint Cyr', 'CS Préfectoral de la VAKAGA', 'Adm Civ', NULL, NULL, 39, 'Actif'),
  ('p430', 'YANGONGO', 'Joël', 'CS de la Ville de Bangui', NULL, NULL, NULL, 39, 'Actif'),
  ('p431', 'DOUMATCHI GANA', 'Aubin Martial', 'CC de Formation de Production Xavier Sylvstre YANGONGO', 'Attaché d''administration', NULL, NULL, 39, 'Actif'),
  ('p432', 'AZOUGBIANDO', 'Joycksin David', 'CC de Formtion et de Production de MANDJO', 'Ing Agro', NULL, NULL, 39, 'Actif'),
  ('p433', 'MOGOSSE', 'Johanne Junior', 'CC de Formation et de Production de BOUBOU', 'Ign Agro', '100732A', NULL, 39, 'Actif'),
  ('p434', 'KOVOLO BINDALA', 'Chancelvy', 'CC de formtion et de Production de NDELE', 'Admi Civ', NULL, NULL, 39, 'Actif'),
  ('p435', 'GUIMANAU', 'Martin Fleury', 'CC de formtion et de Production de BOUAR', 'Tech Sup Agri', NULL, NULL, 39, 'Actif'),
  ('p436', 'WAYERE', 'Nestor', 'Chef du Centre de formation et de PRODUCTION DE MBAÏKI', 'Ing Génie Rural', NULL, NULL, 39, 'Actif'),
  ('p437', 'YANDIA', 'Achille', 'CC de Formation et de Production de KAGA-BANDORO', 'tech SUP Elevage', NULL, NULL, 39, 'Actif'),
  ('p438', 'DOLE YEMBI', 'Max Fulbert', 'CC de Formation et de Production de GBAKOMALEKPA', 'Adm Civ', NULL, NULL, 39, 'Actif'),
  ('p439', 'BRIA', 'Napoléon Symphorien', 'CC de Formation et de Production de KOBADJIA', 'Chargé des Travaux', '102836D', NULL, 39, 'Actif'),
  ('p440', 'KOSSINGOU', 'Niva Nestor', 'Dircteur de Service de Santé', 'Medecin', NULL, NULL, 39, 'Actif'),
  ('p441', 'OUSMAN', 'Alexis', 'CS deSuivi Sanitaire des Pionniers', 'Hors Statut', NULL, NULL, 39, 'Actif'),
  ('p442', 'YANOUE', 'Brice', 'CS de Santé Animale', 'Sergent Chef', '900388P', NULL, 39, 'Actif'),
  ('p443', 'NGUEREZAPA', 'Richard', 'Chargé de Mission', 'Hors Statut', NULL, NULL, 39, 'Actif'),
  ('p444', 'BIDA KETTE', 'Syntiche', 'Chargé d''etude', 'Ign Agro', '62242P', NULL, 39, 'Actif'),
  ('p445', 'BALEMANGA', 'Barthelemi', 'Chargé d''étude', 'Adm Civ', '11026W', NULL, 39, 'Actif'),
  ('p446', 'MBANGUE', 'Blaisse', 'Chargé d''étude', 'Hors Statut', NULL, NULL, 39, 'Actif'),
  ('p447', 'ZOUMALDOU', 'Marcelin', 'DIRECTEIR REGIONAL N°5', 'Adm Civ', '20245G', NULL, 39, 'Actif'),
  ('p448', 'LAXA BAKO', 'Pierre', 'Chef de Service', 'Hors Statut', '33783Y', NULL, 39, 'Actif'),
  ('p449', 'NDODE', 'Romialde', 'Chef de service Archives', 'Hors Statut', '35275R', NULL, 39, 'Actif'),
  ('p450', 'BASSALA NGARASIO', 'Vianney', 'CS palnification', 'Hors Statut', NULL, NULL, 39, 'Actif'),
  ('p451', 'GBONDELE NGUINON BADEMAN IDA', 'née', 'CS suivi et évaluation', 'Ing des eaux et forêt', NULL, NULL, 39, 'Actif'),
  ('p452', 'ADOU YPOLITE', 'Armel', 'CS de la formation', 'Adm Civ', NULL, NULL, 39, 'Actif'),
  ('p453', 'NZELA SILVERT DIEU', 'Beni', 'CS insertion et de crédit', 'Hors Statut', '11125Y', NULL, 39, 'Actif'),
  ('p454', 'KON-YINA NADEGE', 'Ingride', 'CS éducation civique', 'Cons en jeunesse', '10267H', NULL, 39, 'Actif'),
  ('p455', 'NDOKO LIONEL', 'Dave', 'CS PREFECTORAL', 'Hors Statut', NULL, NULL, 39, 'Actif'),
  ('p456', 'TONGOMALE', 'Gislain', 'CS PREFECTORAL', 'Ign Agro', NULL, NULL, 39, 'Actif'),
  ('p457', 'NGBOLO', 'Armel', 'CS PREFECTORAL', 'Hors Statut', '10286L', NULL, 39, 'Actif'),
  ('p458', 'GUEBAMIGO', 'Rodrigue', 'CS PREFECTORAL', 'Ign eaux et forêt', NULL, NULL, 39, 'Actif'),
  ('p459', 'NGBAKONGO EUSEB', 'Leger', 'CS PREFECTORAL', 'Ing des eaux et forêt', NULL, NULL, 39, 'Actif'),
  ('p460', 'GOFFI', 'Christian', 'CS PREFECTORAL', 'Hors Statut', '801218Z', NULL, 39, 'Actif'),
  ('p461', 'OBAWA ROMARIC', 'Silvert', 'Chef de Centre', 'Ign des Trvaux', NULL, NULL, 39, 'Actif'),
  ('p462', 'YONGORO EVELIN', 'Marcis', NULL, 'INSTITUTEUR', NULL, NULL, 39, 'Actif'),
  ('p463', 'LINGBIMA', 'Gislain', 'Chef de centre', 'Prof de college', NULL, NULL, 39, 'Actif'),
  ('p464', 'TCHABASSINI LENBGUE', 'Odilon', 'Chef de Centre', 'Hors Statut', '11036Y', NULL, 39, 'Actif'),
  ('p465', 'BOYSILANGUE NDOROUM', 'Narcis', 'CS SPORT', 'Adj', '94175M', NULL, 39, 'Actif'),
  ('p466', 'NOGODE MALIODE', 'Piero', 'Chef de centre', 'Hors Statut', NULL, NULL, 39, 'Actif'),
  ('p467', 'DOKAYE-NAZONGO', 'Josiane', 'Expert en Matière d''Administration', 'Attaché d''administration', NULL, NULL, 40, 'Actif'),
  ('p468', 'GOTTO', 'Cyrielle Geraldine', 'Expert en Matière d''Administration', 'Administeur civ', NULL, NULL, 40, 'Actif'),
  ('p469', 'NDJAPOU GALINA', 'Eva', 'Expert en Matière d''Intelligence Technique', 'Ingenieur en tellecom', NULL, NULL, 40, 'Actif'),
  ('p470', 'NGAMATOU-LOBALI', 'Aristophane Madizon', 'Expert en Matière d''Intelligence Technique', 'Admi civ', NULL, NULL, 40, 'Actif'),
  ('p471', 'KOUDOUMALE', 'Prince Maïvain Joé', 'Expert en matière de Contrôle Interne de Sécurité', 'Administeur civ', NULL, NULL, 40, 'Actif'),
  ('p472', 'BAKA', 'Hiver Arcad', 'Directeur', 'Hors Staut', NULL, NULL, 40, 'Actif'),
  ('p473', 'KONGOLO SIOPATHIS', 'Robby Maruis', 'Directeur', 'Hors Staut', NULL, NULL, 40, 'Actif'),
  ('p474', 'DERO', 'Teddy Axel', 'Chef de Departement', 'Hors Staut', NULL, NULL, 40, 'Actif'),
  ('p475', 'SAN-NAM DAN', 'Stève', 'Chef de Departement', 'Hors Staut', NULL, NULL, 40, 'Actif'),
  ('p476', 'NDAMASSINGBA MBOLIPATIRANI', 'Flavien', 'Chef de Departement', NULL, NULL, NULL, 40, 'Actif');
-- ---------------------------------------------------------------------------
-- Notes de portabilité PostgreSQL
--   ENUM            -> CREATE TYPE ... AS ENUM, ou VARCHAR + CHECK
--   AUTO_INCREMENT  -> GENERATED ALWAYS AS IDENTITY
--   MEDIUMBLOB/LONGBLOB -> BYTEA        MEDIUMTEXT -> TEXT
--   ENGINE=InnoDB / CHARACTER SET       -> à retirer
--   ON UPDATE CURRENT_TIMESTAMP         -> trigger BEFORE UPDATE
-- ---------------------------------------------------------------------------
