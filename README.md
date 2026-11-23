# BricoLoop

> Un voisin peut emprunter un outil disponible près de chez lui en quelques clics, et le propriétaire garde la main sur ses prêts.

## Équipe

| Membre | Rôle |
|--------|------|
| Rafael De Haro | Développeur, PO du lancement et du Sprint 1 |
| Emerick Marchese | Développeur, PO du Sprint 2 |
| Mathis _(nom à compléter)_ | Développeur, PO du Sprint 3 |
| Dogan _(nom à compléter)_ | Développeur, arrivé au Sprint 3 |

### Rotation PO / SM

|           | PO | SM |
|-----------|----|----|
| Lancement | Rafael | – |
| Sprint 1  | Rafael | _à compléter_ |
| Sprint 2  | Emerick | _à compléter_ |
| Sprint 3  | Mathis | _à compléter_ |

Dogan a rejoint l'équipe au Sprint 3 : il ne restait qu'un sprint, il n'a donc pas pu être PO.

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
| GET | `/api/tools?category=Perçage` |  | US-10 | Filtre par catégorie (400 si la catégorie est inconnue), combinable avec `q` |
| GET | `/api/tools/mine` | oui | US-12 | Mes outils, le nombre de demandes en attente et le prêt en cours |
| GET | `/api/tools/:id/history` | oui | US-14 | Historique des prêts acceptés et rendus, du plus récent au plus ancien (propriétaire seulement) |
| GET | `/api/tools/:id` |  | US-03 | Fiche d'un outil avec le prénom et le quartier du propriétaire (404 si inconnu) |
| POST | `/api/tools` | oui | US-02 | Proposer un outil : `name` (2 à 60), `category`, `description` (facultative, 300 max) |
| POST | `/api/loans` | oui | US-04, US-06 | Demander un emprunt : `toolId`, `startDate`, `endDate` (`AAAA-MM-JJ`) |
| POST | `/api/loans/:id/accept` | oui | US-05 | Le propriétaire accepte une demande (l'outil passe « prêté ») |
| POST | `/api/loans/:id/refuse` | oui | US-05 | Le propriétaire refuse une demande |
| POST | `/api/loans/:id/return` | oui | US-07 | Le propriétaire déclare le retour (l'outil redevient « disponible ») |
| GET | `/api/loans/mine` | oui | US-08 | Mes demandes et emprunts, triés par date de début |
| POST | `/api/loans/:id/rating` | oui | US-13 | Noter l'emprunteur de 1 à 5 (`score`), une fois, sur un prêt rendu |
| GET | `/api/notifications` | oui | US-15 | Mes notifications (demande reçue, acceptée, refusée, retour, note) et le nombre de non lues |
| POST | `/api/notifications/read` | oui | US-15 | Marquer toutes mes notifications comme lues |

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
| US-10 · Filtrer le catalogue par catégorie | _PR à venir_ |
| US-11 · Rechercher un outil par mot-clé | #12 |
| US-12 · Voir mes outils et les demandes reçues | _PR à venir_ |
| US-13 · Noter l'emprunteur après le retour | _PR à venir_ |
| US-14 · Consulter l'historique des prêts d'un outil | _PR à venir_ |
| US-15 · Notifications (ajoutée au backlog par l'équipe) | _PR à venir_ |

État de `main` : `npm run check` → 0 warning de lint, 83 tests verts.

## Vidéo

_lien à ajouter_
