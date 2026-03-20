# ADR-004 : Scraping en Go, zéro stockage, cache mémoire

- **Date** : 2026-03-20
- **Statut** : Accepté

## Contexte

L'architecture initiale repose sur un pipeline en deux langages :

1. **Python** (`scraper_classement.py`, `scraper_calendrier.py`) scrape le site FFBB et écrit des fichiers JSON sur le disque (`data/<ligue>-<competition>/classement.json`, `calendrier.json`).
2. **Go** lit ces fichiers JSON au démarrage et les sert via une API REST.

Cette approche pose plusieurs problèmes opérationnels :

- Deux runtimes à déployer (Python + venv, Go).
- Données périmées : aucun mécanisme d'invalidation automatique.
- Scraping manuel (`make pipeline URL=...`) requis avant chaque déploiement.
- Le déclenchement d'un scrape depuis l'interface web impliquerait que l'API Go spawne un process Python — fragile.
- À terme, l'objectif est d'utiliser **l'API officielle FFBB** dès qu'elle sera disponible. Le scraper Python est temporaire ; il ne vaut pas la peine de maintenir une infrastructure bi-langage pour une couche qui sera remplacée.

## Décision

On migre vers une architecture **mono-runtime Go** avec **zéro fichier de données** :

1. **Le scraper est réécrit en Go** (`internal/scraper/`) en portant exactement la même logique que le Python (fetch HTML, extraction des chunks RSC, parsing HTML du classement, bracket-matching JSON pour les rencontres).
2. **Les données ne sont jamais écrites sur le disque.** Tout reste en mémoire.
3. **L'API Go maintient un cache mémoire TTL** (1 heure par défaut) : le premier appel pour une compétition déclenche le scrape, les suivants servent depuis le cache.
4. **La liste des compétitions connues** est définie dans une config Go (struct) — c'est de la configuration, pas de la data.
5. **Un endpoint de refresh** (`POST /api/competitions/{id}/refresh`) permet de forcer un re-scrape depuis l'interface web.

```
Next.js → GET /api/competitions/{id}/standings
               ↓
          cache hit (TTL 1h) → répond immédiatement
          cache miss → scrape FFBB (2 req HTTP) → stocke en mémoire → répond
```

## Alternatives écartées

**Garder Python + fichiers JSON avec un cron**
Résout le problème de fraîcheur mais pas celui du bi-runtime ni du déploiement. Crée une dépendance à une infra cron externe. Refusé car la complexité opérationnelle reste entière.

**Base de données (SQLite / PostgreSQL)**
Over-engineering pour ce volume (<10 compétitions, ~50 matchs chacune). Introduit une dépendance de déploiement. Refusé — l'objectif est de réduire la complexité, pas de l'augmenter.

**Réécriture Python en service séparé (worker)**
Propre mais maintient deux runtimes à déployer et orchestrer. Refusé pour la même raison.

## Évaluation de la portabilité du scraper Python → Go

| Composant | Difficulté | Stdlib Go utilisée |
|-----------|------------|-------------------|
| `fetch_raw_html` | Triviale | `net/http` |
| `extract_rsc_chunks` | Facile | `regexp`, `encoding/json` |
| `parse_ffbb_url` | Facile | `net/url` |
| `extract_standings_from_html` | Facile | `regexp` (patterns identiques) |
| Bracket-matching rencontres | Moyenne | Boucle sur `string`, `encoding/json` |
| `normalize_rencontre` + `group_by_date` | Facile | `time`, `sort` |
| Fallback Playwright | **Abandonné** | Non-déployable, non-nécessaire |

Aucune dépendance externe en Go. Stdlib uniquement.

## Conséquences

- Les fichiers `data/` et les scripts Python sont supprimés (hormis les fixtures de test).
- Le `Makefile` est simplifié : plus de `pipeline`, `classement`, `calendrier`.
- Si le site FFBB change sa structure HTML, le scraper Go casse de la même façon que le Python — le comportement de panne est identique.
- Quand l'API officielle FFBB sera disponible, on remplace `internal/scraper/` par un client API sans toucher au reste.
- Le cache mémoire est perdu au redémarrage du process Go. Le premier visiteur après un restart attend ~2-3s le temps du scrape. Acceptable pour un projet de cette taille.
