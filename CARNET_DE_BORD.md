# Carnet de bord – BricoLoop

> Product Goal : un voisin peut emprunter un outil disponible près de chez lui en quelques clics, et le propriétaire garde la main sur ses prêts.

## En-tête

| | |
|---|---|
| Équipe | _Jus de Bissap_ |
| Membres | Emerick Marchese · Rafael De Haro · Mathis _(nom à compléter)_ |
| Dépôt | https://github.com/PR0X1T34/bricoloop |
| Vidéo | _lien à ajouter_ |
| Date | jeudi 22 octobre 2026 |

### Rotation PO / SM effective

| | PO | SM |
|---|---|---|
| Lancement | Rafael | – |
| Sprint 1 | Rafael | _Aucun_ |
| Sprint 2 | Emerick | _Aucun_ |
| Sprint 3 | Mathis | _Aucun_ |

## Lancement

**Estimation du backlog (Planning Poker)**

| Story | Priorité | Valeur PO | Points |
|---|---|---|---|
| US-01 Consulter le catalogue | Must | 40 | _?_ |
| US-02 Proposer un outil | Must | 35 | _?_ |
| US-03 Voir le détail d'un outil | Must | 20 | _?_ |
| US-04 Demander l'emprunt | Must | 50 | _?_ |
| US-05 Accepter ou refuser une demande | Must | 45 | _?_ |
| US-06 Empêcher les chevauchements | Should | 30 | _?_ |
| US-07 Déclarer le retour | Should | 25 | _?_ |
| US-08 Voir mes emprunts | Should | 20 | _?_ |
| US-09 Interface web | Should | 40 | _?_ |

**Sprint 0 (état à 11:15 → 11:20)** : dépôt créé, `main` protégée (pas de push direct, 1 review obligatoire), README, outillage `npm run lint` / `npm test` / `npm run check`, seed de 4 voisins et 8 outils dans 5 catégories, CI GitHub Actions qui lance `npm run check` sur chaque PR. Tout est livré dans le commit `chore: sprint 0 - setup projet` (11:20). T-01 à T-04 sont donc Done, bonus CI compris.

**Décisions du PO du lancement (Rafael)** : _à compléter_

## Déroulé réel (d'après l'historique Git)

| Heure | Événement | PR |
|---|---|---|
| 11:20 | Sprint 0 : setup du projet | – |
| 11:32 → 11:54 | US-01 catalogue (test puis feat), mergée | #2 |
| 12:00 → 12:06 | US-03 détail d'un outil, mergée | #3 |
| 12:04 → 12:07 | US-04 demande d'emprunt, mergée | #4 |
| 12:09 → 12:11 | US-05 accepter / refuser, mergée | #5 |
| 12:16 → 12:20 | US-02 proposer un outil, corrigée puis mergée | #7 |
| 12:18 → 12:26 | US-07 retour d'un outil, mergée | #8 |
| 12:13 → 12:27 | US-06 chevauchements, conflit résolu puis mergée | #6 |
| 12:27 → 12:32 | US-08 mes emprunts, corrigée puis mergée | #9 |
| ≈ 12:32 | **Fin du Sprint 1.** Le Sprint 2 commence par un Daily Scrum : point sur l'avancement et sur ce qu'il reste à faire | – |
| 12:34 → 12:46 | US-09 interface web, conflit résolu puis mergée | #11 |

À 12:46, `main` contient US-01 à US-09 : `npm run check` donne 0 warning de lint et 76 tests verts.

## Sprint 1

| | |
|---|---|
| PO / SM | Rafael / _à compléter_ |
| Sprint Goal | _à compléter_ (ex. : « Un voisin peut voir le catalogue, ouvrir une fiche et demander un outil ») |
| Points engagés / Done | _à compléter_ |
| Burndown (début / +15 / +30 / fin) | _à compléter_ |

**Stories Done** : US-01 à US-08. Chaque story a sa branche `feature/US-xx-…` partie de `main`, un commit `test:` puis un commit `feat:`, au moins un test par critère d'acceptation (cas d'erreur compris), une PR et la CI au vert avant le merge.

**Imprévus et réaction de l'équipe**

- **Doublon de US-01 (PR #1)** : une branche `PR0X1T34-patch-1` a été créée en éditant directement sur le site GitHub. Commit non préfixé, nom de branche hors convention : elle ne respectait pas la DoD et faisait doublon avec la PR #2.
- **US-02 a écrasé la route US-05** : la branche US-02 contenait une ancienne version de `src/app.js`, et 5 tests de US-05 sont passés au rouge. Ce sont les tests qui ont détecté le problème avant le merge, et la correction est arrivée dans un commit `fix:` de la PR #7.
- **Conflit entre US-02 (#7) et US-06 (#6)** : les deux ajoutaient des fonctions au même endroit de `app.js`. Résolu en intégrant `main` dans la branche US-06 avant de la merger.
- **US-08 a repris du code de US-06** : la branche était partie d'un `main` trop ancien, d'où un commit `fix:` pour réaligner le code avant le merge (#9).
- **Modification de `eslint.config.js` par l'interface GitHub (PR #10)** : commit « Update eslint.config.js » non préfixé, sur une branche hors convention. Le contenu était correct, mais pas la forme.

**Ce que nous en retenons** : plusieurs personnes modifiaient le même fichier `src/app.js` en parallèle. La règle « branche créée depuis `main` à jour » est donc essentielle, et les tests automatiques et la CI nous ont évité de merger du code cassé.

**Décisions du PO** : _à compléter_

**Rétrospective**

| Start | Stop | Continue |
|---|---|---|
| Faire `git pull` sur `main` avant chaque nouvelle branche et juste avant d'ouvrir la PR | Modifier des fichiers directement sur le site GitHub (commits non préfixés, branches `patch-x`) | Écrire le test avant le code, un commit `test:` puis un `feat:` |
| _à compléter_ | _à compléter_ | Faire un daily dès qu'une story importante est mergée |

**Action retenue pour le sprint suivant** : _à compléter_ (proposition : « mettre `main` à jour dans sa branche avant d'ouvrir une PR »). Responsable : _à compléter_

## Sprint 2

| | |
|---|---|
| PO / SM | Emerick / _à compléter_ |
| Sprint Goal | _à compléter_ (ex. : « Un voisin fait tout le parcours d'emprunt depuis une page web ») |
| Points engagés / Done | _à compléter_ |
| Burndown | _à compléter_ |
| Stories acceptées / refusées | US-09 Interface web, acceptée (PR #11) |
| Imprévus et réaction | Conflit sur US-09 : résolu en intégrant `main` dans la branche (`chore: intégrer main dans US-09`) avant le merge de la PR #11 |
| Rétro (Start / Stop / Continue) et action | _à compléter_ |
| Action du sprint 1 appliquée ? | _à compléter_ |

**Daily Scrum** : dès le début du Sprint 2, nous avons fait un daily pour faire le point sur l'avancement : stories terminées au Sprint 1 (US-01 à US-08), PR en attente de relecture, et ce qu'il restait à faire (US-09). C'est là que nous avons décidé que l'interface web de US-09 afficherait aussi « Mes demandes » (US-08).

## Sprint 3

| | |
|---|---|
| PO / SM | Mathis / _à compléter_ |
| Sprint Goal | _à compléter_ |
| Points engagés / Done | _à compléter_ |
| Burndown | _à compléter_ |
| Stories acceptées / refusées | _à compléter_ |
| Imprévus et réaction | _à compléter_ |
| Rétro (Start / Stop / Continue) et action | _à compléter_ |
| Action du sprint 2 appliquée ? | _à compléter_ |

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

Pas encore commencées : US-10 à US-14.

**Valeur PO livrée** : 305 sur 365 (84 %). Toutes les stories Must (190) et les 4 premières Should (115) sont livrées.

## Bilan

- **Vélocité sur les 3 sprints** : _à compléter_
- **Ce qui a bien marché** : tout le parcours Must (catalogue → fiche → demande → acceptation → retour) est livré et testé, avec une interface web. Les tests automatiques ont détecté une régression avant le merge (route US-05 écrasée par la branche US-02).
- **Ce qui a coincé** : trop de modifications en parallèle dans un seul fichier (`src/app.js`), d'où des conflits et du code écrasé. Il aurait fallu découper les routes en plusieurs fichiers (`src/routes/…`). Deux PR ont été faites depuis l'interface GitHub sans respecter la convention.
- **Retour de chaque PO sur son rôle** (3 à 4 lignes chacun) :
  - Rafael (lancement et sprint 1) : _à compléter_
  - Emerick (sprint 2) : _à compléter_
  - Mathis (sprint 3) : _à compléter_
- **Un apprentissage par membre** : _à compléter_
