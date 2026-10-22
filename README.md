# BricoLoop

> Un voisin peut emprunter un outil disponible près de chez lui en quelques clics, et le propriétaire garde la main sur ses prêts.

## Équipe

| Membre | Rôle |
|--------|------|
| _à compléter_ | |

### Rotation PO / SM

|           | PO | SM |
|-----------|----|----|
| Lancement |    | –  |
| Sprint 1  |    |    |
| Sprint 2  |    |    |
| Sprint 3  |    |    |

## Lancer le projet

Prérequis : Node.js 20 ou plus.

```bash
npm install      # installe les dépendances
npm start        # lance l'API et l'interface web sur http://localhost:3000
npm run check    # lint (0 warning) + tests
```

Vérification rapide : `curl http://localhost:3000/health` → `{"status":"ok"}`

Identification : l'utilisateur courant est passé dans l'en-tête HTTP `X-User-Id` (ex. `u1`).
Données de démo : 4 voisins (`u1` à `u4`) et 8 outils, chargés au démarrage (`src/seed.js`).

Interface web : ouvrir http://localhost:3000 dans un navigateur, choisir son profil, puis parcourir le catalogue, ouvrir une fiche et envoyer une demande.

## API

Toutes les routes répondent en JSON. Celles qui ont « oui » dans la colonne `X-User-Id` renvoient 401 sans cet en-tête.

| Méthode | Route | X-User-Id | Story | Description |
|---|---|---|---|---|
| GET | `/health` |  | T-02 | Vérifie que l'API répond |
| GET | `/api/users` |  | US-09 | Liste des voisins (sélecteur de profil) |
| GET | `/api/tools` |  | US-01 | Catalogue, outils disponibles en premier |
| GET | `/api/tools?q=perceuse` |  | US-11 | Recherche dans le nom et la description, sans tenir compte des majuscules |
| GET | `/api/tools/:id` |  | US-03 | Fiche d'un outil avec le prénom et le quartier du propriétaire (404 si inconnu) |
| POST | `/api/tools` | oui | US-02 | Proposer un outil : `name` (2 à 60), `category`, `description` (facultative, 300 max) |
| POST | `/api/loans` | oui | US-04, US-06 | Demander un emprunt : `toolId`, `startDate`, `endDate` (`AAAA-MM-JJ`) |
| POST | `/api/loans/:id/accept` | oui | US-05 | Le propriétaire accepte une demande (l'outil passe « prêté ») |
| POST | `/api/loans/:id/refuse` | oui | US-05 | Le propriétaire refuse une demande |
| POST | `/api/loans/:id/return` | oui | US-07 | Le propriétaire déclare le retour (l'outil redevient « disponible ») |
| GET | `/api/loans/mine` | oui | US-08 | Mes demandes et emprunts, triés par date de début |

Catégories autorisées : Perçage, Jardinage, Peinture, Nettoyage, Mesure, Autre.

Exemple :

```bash
curl -X POST http://localhost:3000/api/tools \
  -H "Content-Type: application/json" -H "X-User-Id: u1" \
  -d '{"name":"Ponceuse","category":"Peinture"}'
```

## Structure

```
src/app.js      createApp() : l'application Express (sans ouvrir de port)
src/server.js   démarrage (listen)
src/seed.js     données de démo et catégories
public/         interface web (HTML/JS) servie par Express
test/           tests Vitest + Supertest
```

## Règles de travail (Definition of Done)

- Une branche par story : `feature/US-xx-slug` (ou `fix/...`) créée depuis `main` à jour
- Commits préfixés : `feat:`, `fix:`, `test:`, `refactor:`, `docs:`
- Au moins un test par critère d'acceptation, `npm run check` vert
- Pull request relue et approuvée par un autre membre, pas de push direct sur `main`

## Stories Done

| Story | PR |
|-------|----|
| T-01 à T-04 · Sprint 0 (dépôt, outillage, seed, CI) | – |
| US-01 · Consulter le catalogue des outils | #2 |
| US-02 · Proposer un outil au prêt | #7 |
| US-03 · Voir le détail d'un outil | #3 |
| US-04 · Demander l'emprunt d'un outil | #4 |
| US-05 · Accepter ou refuser une demande | #5 |
| US-06 · Empêcher les emprunts qui se chevauchent | #6 |
| US-07 · Déclarer le retour d'un outil | #8 |
| US-08 · Voir mes emprunts | #9 |
| US-09 · Interface web du parcours d'emprunt | #11 |
| US-11 · Rechercher un outil par mot-clé | #12 |

État de `main` : `npm run check` → 0 warning de lint, 83 tests verts.

## Vidéo

_lien à ajouter_
