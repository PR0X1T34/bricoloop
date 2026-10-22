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
npm start        # lance l'API sur http://localhost:3000
npm run check    # lint (0 warning) + tests
```

Vérification rapide : `curl http://localhost:3000/health` → `{"status":"ok"}`

Identification : l'utilisateur courant est passé dans l'en-tête HTTP `X-User-Id` (ex. `u1`).
Données de démo : 4 voisins (`u1` à `u4`) et 8 outils, chargés au démarrage (`src/seed.js`).

## Structure

```
src/app.js      createApp() : l'application Express (sans ouvrir de port)
src/server.js   démarrage (listen)
src/seed.js     données de démo
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
| _à compléter_ | |

## Vidéo

_lien à ajouter_
