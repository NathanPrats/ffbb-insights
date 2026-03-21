# ffbb-insights

Tableau de bord d'analyse des compétitions de basketball de la Fédération Française de Basketball (FFBB).

Le projet scrappe en temps réel les classements et calendriers depuis le site officiel `competitions.ffbb.com`, et les expose via une API Go. Un frontend Next.js permet de visualiser les classements, simuler des scénarios de fin de saison (qui peut encore monter ? descendre ?) et calculer des projections statistiques.

**Live** : [ffbb-insights-vercel.vercel.app](https://ffbb-insights-vercel.vercel.app)
**API** : [ffbb-insights.onrender.com](https://ffbb-insights.onrender.com)

## Architecture

Le projet est un monorepo composé de deux parties indépendantes :

- **`cmd/api/`** — serveur HTTP Go qui scrappe le site FFBB à la demande, met les données en cache mémoire (TTL 1h) et expose une API REST
- **`web/`** — frontend Next.js qui consomme l'API via un proxy rewrite

```
ffbb-insights/
├── cmd/api/main.go       # Point d'entrée de l'API
├── internal/
│   ├── scraper/          # Scraping HTML → structs Go
│   ├── standings/        # Modèles, simulation Monte Carlo
│   └── cache/            # Cache mémoire TTL
├── web/                  # Frontend Next.js
│   ├── app/              # Pages (App Router)
│   ├── components/       # Composants React
│   └── lib/              # Utilitaires fetch
└── Makefile
```

## Développement local

### Prérequis

- Go 1.22+
- Node.js 18+

### Lancer l'API

```bash
make run
# API disponible sur http://localhost:8080
```

### Lancer le frontend

```bash
cd web && npm install && npm run dev
# Frontend disponible sur http://localhost:3000
```

## API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/competitions` | Liste des compétitions |
| `POST` | `/api/competitions/scrape` | Ajouter une compétition via URL FFBB |
| `GET` | `/api/competitions/{id}/standings` | Classement |
| `GET` | `/api/competitions/{id}/calendar` | Calendrier |
| `GET` | `/api/competitions/{id}/projections` | Projections de fin de saison |
| `POST` | `/api/competitions/{id}/simulate` | Simulation de scénarios |
| `POST` | `/api/competitions/{id}/refresh` | Forcer un re-scrape |

## Déploiement

- **Frontend** : Vercel — Root Directory `web`, variable d'env `NEXT_PUBLIC_API_URL=https://ffbb-insights.onrender.com`
- **API** : Render — Root Directory `cmd/api`, Start Command `./app -port $PORT`
