# ADR-003 : Architecture interface web

- **Date** : 2026-03-18
- **Statut** : Accepté

## Contexte

Le projet dispose d'un CLI Go performant (Monte Carlo 10M simulations) et de données JSON
pré-scrappées dans `data/`. L'objectif est d'exposer ces analyses via une interface web
permettant à l'utilisateur d'explorer des scénarios pour ses équipes favorites.

## Décision

### Backend : Go HTTP API (`cmd/api/`)

On réutilise le package `internal/standings` existant et on l'expose via un serveur HTTP Go
(stdlib `net/http`). Pas de framework — les endpoints sont simples et peu nombreux.

**Endpoints :**

```
GET  /api/competitions                          → liste des compétitions disponibles (dossiers data/)
GET  /api/competitions/:id/standings            → classement + stats
GET  /api/competitions/:id/projections?top=N&bottom=N  → Monte Carlo standard
POST /api/competitions/:id/simulate             → Monte Carlo avec matchs forcés (F2)
```

**Format POST /simulate :**
```json
{
  "overrides": [
    { "domicile": "TEAM A", "visiteur": "TEAM B", "winner": "domicile" }
  ],
  "target_positions": [1, 2]
}
```

Le serveur lit les fichiers JSON depuis `data/` au démarrage (ou à chaque requête — simple,
pas de base de données).

### Frontend : Next.js App Router (`web/`)

Next.js minimaliste, App Router, TypeScript, Tailwind CSS. Pas de composant UI tiers.

**Pages :**
```
/                     → liste des compétitions
/[id]                 → classement intelligent (F3)
/[id]/projections     → chemin vers la montée/maintien (F1)
/[id]/simulateur      → simulateur interactif (F2)
```

### Communication

En dev : Next.js proxifie `/api/*` vers Go (`localhost:8080`).
En prod : Go sert à la fois l'API et les fichiers statiques buildés Next.js.

## Alternatives écartées

**Node.js/Express pour l'API**
Le moteur Monte Carlo est en Go et performant. Réécrire en Node ou appeler un sous-processus
Go depuis Node serait inutilement complexe.

**Next.js full-stack (API Routes)**
Les calculs Monte Carlo (10M simulations parallèles) doivent rester en Go.
Les API Routes Next.js ne sont pas adaptées à ce type de charge CPU.

**Base de données**
Les données sont des snapshots scrappés, mises à jour manuellement. Des fichiers JSON suffisent
à ce stade. Une DB serait du sur-engineering.

## Conséquences

- `cmd/api/main.go` remplace (ou coexiste avec) `cmd/analyse/main.go`
- Le package `internal/standings` n'est pas modifié — il est déjà bien découplé
- Le frontend Next.js est dans `web/` à la racine du repo (monorepo simple)
- `make dev` démarre les deux serveurs en parallèle
