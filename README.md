# BricoLoop · équipe Jus de Bissap

> Un voisin peut emprunter un outil disponible près de chez lui en quelques clics, et le propriétaire garde la main sur ses prêts.

Projet fil rouge de l'atelier Scrum EPSI B3. **Les 14 stories de l'énoncé sont livrées**, plus 6 stories ajoutées par l'équipe (US-15 à US-20). `npm run check` : 0 warning de lint, 165 tests verts.
Le déroulé de la journée, sprint par sprint, est dans le [carnet de bord](CARNET_DE_BORD.md).

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
| Sprint 1  | Rafael | Aucun désigné |
| Sprint 2  | Emerick | Aucun désigné |
| Sprint 3  | Mathis | Dogan _(à confirmer)_ |

Dogan a rejoint l'équipe au Sprint 3 : il ne restait qu'un sprint, il n'a donc pas pu être PO.

## Lancer le projet

Prérequis : Node.js 20 ou plus.

```bash
npm install      # installe les dépendances
npm start        # lance l'API et l'interface web sur http://localhost:3000
npm run check    # lint (0 warning) + tests
```

Vérification rapide : `curl http://localhost:3000/health` → `{"status":"ok"}`

### Comptes et connexion (US-18)

Sur le site, chacun se connecte avec son compte (ou en crée un depuis la page).
Comptes de démo : `alice@bricoloop.test`, `bruno@bricoloop.test`, `chloe@bricoloop.test`, `driss@bricoloop.test`, mot de passe `bricoloop`.

- Les mots de passe sont hachés (scrypt avec sel), jamais stockés en clair.
- La connexion renvoie un jeton à envoyer dans l'en-tête `Authorization: Bearer <jeton>` (valable 7 jours).
- L'identification par l'en-tête `X-User-Id` de l'énoncé reste disponible pour les tests et pour démontrer l'API : lancer avec `ALLOW_USER_ID_HEADER=1 npm start`. Elle est désactivée par défaut sur le vrai serveur.

### Données (US-19)

Les données sont enregistrées dans `data/bricoloop.json` (créé au premier changement, ignoré par Git) : comptes, outils, photos et prêts sont conservés après un redémarrage.
Pour repartir des données de démo, supprimer ce fichier. `DATA_FILE=memory npm start` garde tout en mémoire.

### Interface web (une page par onglet, US-20)

Ouvrir http://localhost:3000. Chaque page a sa propre adresse, qu'on peut partager :

| Page | Adresse | Ce qu'on y fait |
|---|---|---|
| Catalogue | `#/` | Rechercher, filtrer par catégorie, quartier ou disponibilité, trier |
| Outil | `#/outil/t1` | Photos, état (prêts, retours, demandes en attente), calendrier des réservations, demande d'emprunt avec un message ; pour le propriétaire : historique, note, modifier, supprimer, rendre indisponible |
| Modifier | `#/outil/t1/modifier` | Nom, catégorie, description, disponibilité, photos |
| Proposer | `#/proposer` | Nouvel outil avec photos |
| Mes outils | `#/mes-outils` | Demandes reçues (avec le message), accepter, refuser, déclarer un retour |
| Mes demandes | `#/demandes` | En attente (annulables), en cours, terminées |
| Notifications | `#/notifications` | Accepter ou refuser directement, aller à l'outil |
| Mon compte | `#/compte` | Mes chiffres, modifier mon profil, changer de mot de passe |
| Connexion | `#/connexion` | Se connecter ou créer un compte |

Le site suit le thème clair ou sombre de l'appareil et s'utilise sur téléphone.

## API

Toutes les routes répondent en JSON (sauf les photos). Celles qui ont « oui » dans la colonne « Compte » renvoient 401 sans utilisateur identifié : jeton `Authorization: Bearer …`, ou en-tête `X-User-Id` en mode énoncé.

| Méthode | Route | Compte | Story | Description |
|---|---|---|---|---|
| GET | `/health` |  | T-02 | Vérifie que l'API répond |
| POST | `/api/auth/register` |  | US-18 | Créer un compte : `email`, `password` (8 caractères minimum), `firstName`, `district` |
| POST | `/api/auth/login` |  | US-18 | Se connecter : `email`, `password` → `{ token, user }` |
| POST | `/api/auth/logout` | oui | US-18 | Se déconnecter (le jeton n'est plus valable) |
| GET | `/api/auth/me` | oui | US-18 | Mon compte |
| PATCH | `/api/auth/me` | oui | US-20 | Modifier mon prénom et mon quartier |
| POST | `/api/auth/password` | oui | US-20 | Changer de mot de passe : `currentPassword`, `newPassword` (ferme les autres sessions) |
| GET | `/api/auth/me/stats` | oui | US-20 | Mes chiffres : outils, prêts accordés, emprunts, note moyenne |
| GET | `/api/users` |  | US-09 | Liste publique des voisins (prénom et quartier) |
| GET | `/api/tools` |  | US-01 | Catalogue, outils disponibles en premier |
| GET | `/api/tools?q=perceuse` |  | US-11 | Recherche dans le nom et la description, sans tenir compte des majuscules |
| GET | `/api/tools?category=Perçage` |  | US-10 | Filtre par catégorie (400 si la catégorie est inconnue), combinable avec `q` |
| GET | `/api/tools/mine` | oui | US-12 | Mes outils, le nombre de demandes en attente et le prêt en cours |
| GET | `/api/tools/:id/history` | oui | US-14 | Historique des prêts acceptés et rendus, du plus récent au plus ancien (propriétaire seulement) |
| GET | `/api/tools/:id` |  | US-03, US-20 | Fiche d'un outil : propriétaire, photos et état d'usage (prêts, retours, réservations à venir, sans nom) ; 404 si inconnu |
| POST | `/api/tools` | oui | US-02 | Proposer un outil : `name` (2 à 60), `category`, `description` (facultative, 300 max) |
| PATCH | `/api/tools/:id` | oui | US-16 | Modifier mon outil (`name`, `category`, `description`, `status` disponible ou indisponible) |
| DELETE | `/api/tools/:id` | oui | US-16 | Retirer mon outil (409 s'il est prêté ; les demandes en attente sont annulées) |
| POST | `/api/tools/:id/photos` | oui | US-17 | Ajouter une photo : `dataUrl` JPEG, PNG, WebP ou GIF, 2 Mo et 4 photos maximum |
| DELETE | `/api/tools/:id/photos/:photoId` | oui | US-17 | Supprimer une photo |
| GET | `/api/photos/:photoId` |  | US-17 | Afficher une photo |
| POST | `/api/loans` | oui | US-04, US-06, US-20 | Demander un emprunt : `toolId`, `startDate`, `endDate` (`AAAA-MM-JJ`), `message` facultatif (300 caractères) |
| POST | `/api/loans/:id/cancel` | oui | US-20 | L'emprunteur annule sa demande tant qu'elle est en attente |
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
src/app.js      createApp() : l'application Express et ses routes (sans ouvrir de port)
src/server.js   démarrage : sauvegarde JSON, comptes obligatoires, listen
src/auth.js     hachage des mots de passe (scrypt) et jetons de session
src/store.js    lecture et écriture de data/bricoloop.json
src/seed.js     données de démo, comptes de démo et catégories
public/         interface web (index.html, style.css, main.js, ui.js) servie par Express
test/           tests Vitest + Supertest (un fichier par story ou par thème)
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
| US-10 · Filtrer le catalogue par catégorie | #15 |
| US-11 · Rechercher un outil par mot-clé | #12 |
| US-12 · Voir mes outils et les demandes reçues | #16 |
| US-13 · Noter l'emprunteur après le retour | #16 |
| US-14 · Consulter l'historique des prêts d'un outil | #16 |
| US-15 · Notifications (ajoutée au backlog par l'équipe) | #16 |
| US-16 · Modifier et supprimer ses outils (ajoutée par l'équipe) | #17 |
| US-17 · Photos des outils (ajoutée par l'équipe) | #17 |
| US-18 · Comptes et connexion (ajoutée par l'équipe) | #17 |
| US-19 · Sauvegarde dans un fichier JSON (ajoutée par l'équipe) | #17 |
| US-20 · Une page par onglet, page complète d'un outil, options (ajoutée par l'équipe) | #18 |

État de `main` : `npm run check` → 0 warning de lint, 165 tests verts. Valeur PO livrée : 365 sur 365.

Écarts assumés (détaillés dans le carnet) : pas de Scrum Master aux sprints 1 et 2 ; les PR #1 et #10 faites depuis l'interface GitHub ; les PR #16 et #17 regroupent plusieurs stories. Une partie du code a été écrite avec l'aide d'un assistant IA (commits signés « Claude »), relue et approuvée par l'équipe avant chaque merge.

## Vidéo

_lien à ajouter_ (démonstration de 3 à 5 minutes sur `main`)
