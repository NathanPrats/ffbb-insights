# Backlog ffbb-insights

## En cours

- Rien pour l'instant — F2 terminé, choisir la prochaine feature

## Features interface (priorisées)

| # | Feature | Priorité | Dépendances | Statut |
|---|---------|----------|-------------|--------|
| F3 | Classement intelligent (forme, calendrier restant, feux rouge/orange/vert) | 1 | — | ✅ fait |
| F1 | Chemin vers la montée / maintien (Monte Carlo, version simple + détaillée) | 2 | F3 | ✅ fait |
| F2 | Simulateur interactif (toggle win/loss, recalcul live pts + probas) | 3 | F1 | ✅ fait |
| F4 | Matchs décisifs ("ce match vaut 40% de maintien") | 4 | F1, F2 | — |
| F5 | Scénarios clés automatiques (meilleur cas, pire cas, scénario réaliste) | 5 | F2, F4 | — |
| F6 | Départage visible en cas d'égalité : groupement visuel + colonne diff dans le simulateur | 6 | F2 | — |

## Backlog technique

- [ ] **Scraping à la demande** — déclencher le scraping depuis l'interface web (pipeline Go → Python) au lieu de dépendre de fichiers JSON pré-générés

## Terminé

- [x] F3 — Classement intelligent (forme récente, difficulté calendrier, indicateurs couleur)
- [x] F1 — Projections Monte Carlo (toggle montée/relégation, N places, barre de progression)
- [x] Go API REST (competitions, standings, calendar, projections, simulate)
- [x] ADR-003 : architecture interface web
- [x] Scraper classement (Python, RSC parsing)
- [x] Scraper calendrier (Python, RSC parsing)
- [x] Pipeline unifié `make pipeline URL=...`
- [x] Analyse Go CLI (classement, stats offenses/défense)
- [x] Projections Monte Carlo (10M simulations, parallel, départage H2H + diff)
- [x] Paramétrage `--top N` / `--bottom N`
- [x] Support multi-compétitions (idf-dm3, idf-rm2, ara-rm3, -nm2, idf-pnm)
- [x] ADR-001 : stratégie scraping RSC
- [x] ADR-002 : stratégie de test Python
