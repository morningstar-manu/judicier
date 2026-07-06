# GestiPers API v1

Base URL : `/api/v1` (prod : `https://www.gestipers.org/api/v1`)

## Variables d'environnement (Vercel)

| Variable | Description |
|----------|-------------|
| `GESTIPERS_API_SECRET` | Signature des tokens JWT API |
| `TURSO_DATABASE_URL` | Base Turso |
| `TURSO_AUTH_TOKEN` | Token Turso |
| `ARIA_IDENTITE_URL` | URL base service Aria Identité (ONCA) |
| `ARIA_IDENTITE_API_KEY` | Clé API Aria (optionnel) |
| `ARIA_REQUESTER_ID` | Identifiant demandeur (défaut : gestipers) |
| `ARIA_LEGAL_BASIS` | Base légale des requêtes |

## Authentification

```http
POST /auth/login
{ "identifiant": "admin", "motDePasse": "..." }
```

Les mots de passe en clair sont migrés automatiquement vers **bcrypt** à la première connexion API.

## Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/health` | Santé + `ariaIdentite: true/false` |
| POST | `/auth/login` | Connexion → token |
| GET | `/auth/me` | Profil |
| POST | `/verify/card` | QR / matricule |
| POST | `/verify/id` | Registres internes + officiel (si date naissance) |
| POST | `/verify/parse-mrz` | Parse texte OCR → champs MRZ |
| POST | `/verify/official` | Vérification ONCA directe |
| GET/POST | `/visiteurs` | Registre visiteurs |
| POST | `/scans` | Upload image base64 |
| GET/POST | `/bagages` | Contrôles bagages |

### Vérification identité combinée

```http
POST /verify/id
{
  "typePiece": "Passeport",
  "numero": "AB1234567",
  "nom": "DUPONT",
  "prenom": "Jean",
  "dateNaissance": "1985-03-12"
}
```

Réponse :

```json
{
  "internal": { "niveau": "conforme", "msg": "...", "matches": [] },
  "official": { "available": true, "ok": true, "data": {} }
}
```

## Base de données

```bash
npm run turso:init        # crée le schéma
npm run seed:personnel    # peuple départements + agents depuis database/seed-personnel.json
```

`seed:personnel` est idempotent : il n'ajoute que les départements/agents absents de
Turso (par nom / id) et n'écrase jamais de données existantes. Le référentiel
personnel (`database/seed-personnel.json`) n'est jamais expédié au navigateur —
l'app web et l'API ne font que lire/écrire dans Turso.

## Mobile (Expo)

```bash
cd mobile && npm install
npx expo start          # Expo Go (sans OCR ML Kit)
npx eas build -p android --profile preview   # APK avec OCR
```

`extra.apiUrl` dans `mobile/app.json` :
- Émulateur : `http://10.0.2.2:5173/api/v1`
- Téléphone : `http://<IP-LAN>:5173/api/v1`
- Prod : `https://www.gestipers.org/api/v1`

## Modules partagés

| Fichier | Rôle |
|---------|------|
| `packages/shared/verify.mjs` | QR, cartes, pièces d'identité |
| `packages/shared/password.mjs` | bcrypt |
| `packages/shared/mrz.mjs` | Parse MRZ |

Import web : `@gestipers/shared/verify.mjs`
