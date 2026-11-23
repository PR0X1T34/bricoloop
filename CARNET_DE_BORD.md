# Carnet de bord – BricoLoop

> Product Goal : un voisin peut emprunter un outil disponible près de chez lui en quelques clics, et le propriétaire garde la main sur ses prêts.

## En-tête

| | |
|---|---|
| Équipe | Jus de Bissap |
| Membres | Rafael De Haro · Emerick Marchese · Mathis _(nom à compléter)_ · Dogan _(nom à compléter, arrivé au Sprint 3)_ |
| Dépôt | https://github.com/PR0X1T34/bricoloop |
| Vidéo | _lien à ajouter_ |
| Dates | Lancement, Sprints 1 et 2 : jeudi 22 octobre 2026 · Sprint 3 : lundi 23 novembre 2026 |

### Rotation PO / SM effective

| | PO | SM |
|---|---|---|
| Lancement | Rafael | – |
| Sprint 1 | Rafael | Aucun désigné |
| Sprint 2 | Emerick | Aucun désigné |
| Sprint 3 | Mathis | Dogan _(à confirmer)_ |

Nous n'avons pas désigné de Scrum Master aux sprints 1 et 2 : c'est notre principal écart au cadre Scrum (voir le bilan). Dogan a rejoint l'équipe au Sprint 3 ; il ne restait qu'un sprint, il n'a donc pas pu tenir le rôle de PO.

## Lancement

**Backlog initial et valeur PO** (ordre du CEO)

| Story | Priorité | Valeur PO |
|---|---|---|
| US-01 Consulter le catalogue | Must | 40 |
| US-02 Proposer un outil | Must | 35 |
| US-03 Voir le détail d'un outil | Must | 20 |
| US-04 Demander l'emprunt | Must | 50 |
| US-05 Accepter ou refuser une demande | Must | 45 |
| US-06 Empêcher les chevauchements | Should | 30 |
| US-07 Déclarer le retour | Should | 25 |
| US-08 Voir mes emprunts | Should | 20 |
| US-09 Interface web | Should | 40 |
| US-10 Filtrer par catégorie | Should | 15 |
| US-11 Rechercher par mot-clé | Could | 15 |
| US-12 Voir mes outils et les demandes reçues | Could | 15 |
| US-13 Noter l'emprunteur | Could | 10 |
| US-14 Historique des prêts d'un outil | Could | 5 |

Les points du Planning Poker n'ont pas été conservés dans le dépôt : nous mesurons donc la vélocité en stories Done et en valeur PO livrée (sur 365 au total).

**Sprint 0 (11:15 → 11:20)** : dépôt créé, `main` protégée (pas de push direct, 1 review obligatoire), README, outillage `npm run lint` / `npm test` / `npm run check`, seed de 4 voisins et 8 outils dans 5 catégories, CI GitHub Actions qui lance `npm run check` sur chaque PR. Tout est livré dans le commit `chore: sprint 0 - setup projet` (11:20). T-01 à T-04 sont Done, bonus CI compris.

**Décisions du PO du lancement (Rafael)** _(à relire)_ : garder l'ordre du CEO, Must d'abord ; une branche `feature/US-xx` par story avec un commit `test:` puis un commit `feat:` ; aucun merge sans PR relue et CI verte.

## Déroulé réel (d'après l'historique Git)

| Date et heure | Événement | PR |
|---|---|---|
| 22/10 11:20 | Sprint 0 : setup du projet | – |
| 22/10 11:29 → 11:56 | US-01 ouverte par erreur depuis l'interface GitHub (#1, fermée), refaite selon la DoD | #2 |
| 22/10 11:59 → 12:11 | US-03, US-04, US-05 (test puis feat), mergées | #3 #4 #5 |
| 22/10 12:12 → 12:27 | US-02, US-06, US-07 : conflits sur `app.js`, corrigés puis mergés | #6 #7 #8 |
| 22/10 12:27 → 12:32 | US-08 mes emprunts, corrigée puis mergée | #9 |
| 22/10 ≈ 12:32 | **Fin du Sprint 1.** Le Sprint 2 commence par un daily | – |
| 22/10 12:34 → 12:46 | US-09 interface web (doublon de travail, lint corrigé) | #10 #11 |
| 22/10 12:47 → 13:00 | US-11 recherche, carnet de bord, README | #12 #13 #14 |
| 23/11 11:08 → 11:47 | **Sprint 3** : US-10 filtre ; US-12 à US-15 espace propriétaire et notifications | #15 #16 |
| 23/11 12:01 → 12:21 | US-16 à US-19 : modifier et supprimer, photos, comptes, sauvegarde | #17 |
| 23/11 12:35 → 12:39 | US-20 : une page par onglet, page complète d'un outil | #18 |

État final de `main` : lint sans warning, **165 tests verts**, toutes les stories de l'énoncé livrées.

## Sprint 1

| | |
|---|---|
| PO / SM | Rafael / aucun désigné |
| Sprint Goal | « Un voisin peut voir le catalogue, ouvrir une fiche, demander un outil, et le propriétaire répond » |
| Stories Done | US-01 à US-08 (8 stories, valeur 265 / 365) |
| Burndown | 8 stories à faire au début ; 1 Done à 11:56 ; 4 Done à 12:11 ; 8 Done à 12:32 |
| Stories refusées | Aucune refusée en Review. La PR #1 (US-01 faite depuis l'interface GitHub, sans tests) a été fermée et remplacée par la #2 |

Chaque story a sa branche `feature/US-xx-…` partie de `main`, un commit `test:` puis un commit `feat:`, au moins un test par critère d'acceptation (cas d'erreur compris), une PR relue et la CI au vert avant le merge.

**Imprévus et réaction de l'équipe**

- **PR #1 hors DoD** : US-01 a d'abord été modifiée directement sur le site GitHub (branche `PR0X1T34-patch-1`, commit non préfixé, sans tests). Elle a été fermée, et US-01 refaite sur une branche `feature/` avec ses tests (#2).
- **US-02 a écrasé la route US-05** : la branche US-02 contenait une ancienne version de `src/app.js`. Les tests de US-05 sont passés au rouge et ont détecté le problème avant le merge ; correction par un commit `fix:` dans la #7.
- **Conflit entre US-02 et US-06** : les deux ajoutaient des fonctions au même endroit de `app.js`. Résolu en gardant les deux, puis `npm run check` avant le merge.
- **US-08 partie d'un `main` trop ancien** : commit `fix:` pour reprendre le code de US-06 avant le merge (#9).

**Décisions du PO** : US-06 a été commencée avant US-02 alors que US-02 est une Must ; le PO a remis US-02 en priorité dès la Review.

**Rétrospective**

| Start | Stop | Continue |
|---|---|---|
| Faire `git pull` sur `main` avant chaque nouvelle branche et juste avant d'ouvrir la PR | Modifier des fichiers directement sur le site GitHub | Écrire le test avant le code : un commit `test:` puis un `feat:` |
| Désigner un Scrum Master | Commencer une Should avant d'avoir fini les Must | Faire relire chaque PR avant le merge |

**Action retenue** : mettre `main` à jour dans sa branche avant d'ouvrir une PR. Responsable : chaque développeur, vérifié en Review.

## Sprint 2

| | |
|---|---|
| PO / SM | Emerick / aucun désigné |
| Sprint Goal | « Un voisin fait tout le parcours d'emprunt depuis une page web » |
| Stories Done | US-09 interface web, US-11 recherche (2 stories, valeur 55 / 365) + README et carnet de bord |
| Burndown | 2 stories au début ; US-09 Done à 12:46 ; US-11 Done à 12:49 |
| Stories refusées | Aucune |

**Daily Scrum** : le sprint a commencé par un daily (stories terminées, PR en attente, reste à faire). Décision : l'interface web de US-09 affiche aussi « Mes demandes » (US-08).

**Imprévus et réaction**

- **Deux développeurs sur US-09** : Rafael et Emerick ont développé l'interface en même temps sans se prévenir (push refusé sur la même branche). Nous avons gardé la version d'Emerick et Rafael a apporté la correction du lint.
- **Lint en erreur sur l'interface** : ESLint ne connaissait pas les variables du navigateur (`document`). Corrigé par la PR #10, faite encore une fois depuis l'interface GitHub (branche et commit hors DoD).
- **Vim ouvert lors d'un merge** : plusieurs commandes collées d'un coup se sont écrites dans le message de merge ; corrigé à la main.

**Rétrospective** _(reconstituée d'après nos échanges, à valider en équipe)_

| Start | Stop | Continue |
|---|---|---|
| Annoncer sa story au daily avant de créer sa branche | Coller plusieurs commandes d'un coup dans le terminal | La CI qui bloque une PR rouge |
| Vérifier `git status` avant de commiter | Faire des modifications depuis l'interface GitHub | Les dailies pour faire le point |

**Action retenue** : annoncer sa story au daily et la noter sur le tableau avant de créer sa branche.
**Action du sprint 1 appliquée ?** En partie : les conflits ont été résolus en intégrant `main`, mais la PR #10 a encore été faite depuis l'interface GitHub.

## Sprint 3

| | |
|---|---|
| PO / SM | Mathis / Dogan _(à confirmer)_ |
| Sprint Goal | « Finir le backlog de l'énoncé et rendre le produit présentable aux investisseurs » |
| Stories Done | US-10, US-12, US-13, US-14 (valeur 45 / 365) + 6 stories ajoutées par l'équipe : US-15 à US-20 |
| Burndown | US-10 Done à 11:47 ; US-12 à US-15 à 11:47 ; US-16 à US-19 à 12:21 ; US-20 à 12:39 |
| Stories refusées | Aucune |

**Stories ajoutées au backlog par l'équipe** (en testant le produit, nous avons trouvé des manques)

| Story | Pourquoi | PR |
|---|---|---|
| US-15 Notifications | Le propriétaire n'était pas prévenu quand on demandait son outil | #16 |
| US-16 Modifier et supprimer ses outils | Impossible de corriger une erreur ou de retirer un outil | #17 |
| US-17 Photos des outils | Pour choisir un outil, il faut le voir | #17 |
| US-18 Comptes et connexion | N'importe qui pouvait se faire passer pour un voisin en choisissant son profil | #17 |
| US-19 Sauvegarde dans un fichier JSON | Tout était perdu à chaque redémarrage (l'énoncé autorise mémoire ou fichier JSON) | #17 |
| US-20 Une page par onglet, page complète d'un outil | État d'usage, calendrier des réservations, message joint, annulation d'une demande, profil | #18 |

US-18 va plus loin que l'énoncé (« pas d'authentification réelle ») : le site utilise de vrais comptes, mais l'API garde le mode de l'énoncé avec l'en-tête `X-User-Id` (option `ALLOW_USER_ID_HEADER=1`), et tous les tests d'origine passent toujours.

**Imprévus et réaction**

- **Arrivée de Dogan** dans l'équipe : il a récupéré le dépôt et la DoD ; la rotation PO ne pouvait plus inclure tout le monde.
- **Dossier local supprimé** : récupéré entièrement par `git clone`, rien n'était perdu car tout passait par des PR.
- **Patch US-10 non appliqué** (fichier jamais arrivé dans le dossier) : refait par copier-coller dans le terminal.
- **Le serveur tournait avec l'ancien code** : le filtre semblait ne rien faire tant que le serveur n'était pas relancé.
- **Aide d'un assistant IA** : une partie du code a été écrite avec l'aide de Claude (assistant IA) ; ces commits sont signés « Claude » dans l'historique et ont été relus et approuvés par un membre de l'équipe avant chaque merge.

**Écart à la DoD** : US-12 à US-15 (#16) et US-16 à US-19 (#17) ont été livrées sur une même branche par lot, au lieu d'une branche par story. Les commits restent préfixés, avec les tests avant le code.

**Rétrospective** _(reconstituée d'après nos échanges, à valider en équipe)_

| Start | Stop | Continue |
|---|---|---|
| Accueillir un nouveau membre avec le README et la DoD | Regrouper plusieurs stories dans une seule PR | Les tests avant le code (165 tests à la fin) |
| Relancer le serveur après chaque `git pull` | Laisser du travail sur une branche sans PR (carnet de bord) | La relecture de chaque PR par un autre membre |

**Action retenue** : avant d'ouvrir une PR, intégrer `main` et relancer `npm run check`. Responsable : le Scrum Master.
**Action du sprint 2 appliquée ?** Oui : chaque story a été annoncée avant d'être commencée, il n'y a plus eu de travail en double.

## Stories Done

| Story | PR |
|---|---|
| US-01 Consulter le catalogue des outils | #2 |
| US-02 Proposer un outil au prêt | #7 |
| US-03 Voir le détail d'un outil | #3 |
| US-04 Demander l'emprunt d'un outil | #4 |
| US-05 Accepter ou refuser une demande | #5 |
| US-06 Empêcher les emprunts qui se chevauchent | #6 |
| US-07 Déclarer le retour d'un outil | #8 |
| US-08 Voir mes emprunts | #9 |
| US-09 Interface web du parcours d'emprunt | #11 |
| US-10 Filtrer le catalogue par catégorie | #15 |
| US-11 Rechercher un outil par mot-clé | #12 |
| US-12 Voir mes outils et les demandes reçues | #16 |
| US-13 Noter l'emprunteur après le retour | #16 |
| US-14 Consulter l'historique des prêts d'un outil | #16 |
| US-15 à US-20 (ajoutées par l'équipe) | #16 #17 #18 |

**Valeur PO livrée** : 365 sur 365 (100 %).

## Bilan

**Vélocité**

| Sprint | Stories de l'énoncé Done | Valeur PO livrée |
|---|---|---|
| Sprint 1 | 8 | 265 |
| Sprint 2 | 2 | 55 |
| Sprint 3 | 4 (+ 6 ajoutées) | 45 |
| **Total** | **14 sur 14** | **365 sur 365** |

Le Sprint 1 a porté l'essentiel de la valeur (toutes les Must). Le Sprint 2 a été court (fin de matinée) ; le Sprint 3 a servi à finir le backlog et à améliorer le produit.

**Ce qui a bien marché**

- Tout le parcours (catalogue → fiche → demande → acceptation → retour → note) est livré, testé et utilisable depuis une interface web.
- Les tests automatiques et la CI ont bloqué plusieurs régressions avant le merge (route US-05 écrasée, code de US-06 perdu).
- `main` est toujours resté démarrable et vert.

**Ce qui a coincé**

- Pas de Scrum Master aux sprints 1 et 2 : personne pour coordonner, d'où du travail en double et des conflits.
- Trop de modifications en parallèle dans un seul fichier (`src/app.js`) ; il aurait fallu découper les routes en plusieurs fichiers.
- Deux PR faites depuis l'interface GitHub, et deux PR regroupant plusieurs stories.

**Retour de chaque PO sur son rôle** _(proposition à relire et reformuler par chacun)_

- **Rafael (lancement et Sprint 1)** : difficile de ne pas coder et de laisser les devs avancer. Refuser ou faire corriger une PR (la #1) fait partie du rôle. J'aurais dû imposer plus tôt l'ordre Must avant Should.
- **Emerick (Sprint 2)** : le daily de début de sprint a permis de décider vite d'intégrer « Mes demandes » à l'interface. Il manquait un tableau à jour pour voir qui travaillait sur quoi.
- **Mathis (Sprint 3)** : arbitrer entre finir le backlog et ajouter des stories utiles. Ajouter US-15 à US-20 au backlog a demandé de les justifier par des besoins concrets.

**Un apprentissage par membre** _(à compléter par chacun)_

- Rafael : _à compléter_
- Emerick : _à compléter_
- Mathis : _à compléter_
- Dogan : _à compléter_
