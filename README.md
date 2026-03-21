# ffbb-insights

Outils d'analyse des classements de la Fédération Française de Basketball (FFBB).

**Live** : [ffbb-insights-vercel.vercel.app](https://ffbb-insights-vercel.vercel.app)
**API** : [ffbb-insights.onrender.com](https://ffbb-insights.onrender.com)

## Structure

```
ffbb-insights/
├── cmd/api/main.go       # API Go (HTTP server)
├── internal/
│   ├── scraper/          # Scraping FFBB
│   ├── standings/        # Modèles + simulation
│   └── cache/            # Cache mémoire
├── web/                  # Frontend Next.js
│   ├── app/              # Pages (App Router)
│   ├── components/       # Composants React
│   └── lib/              # Utilitaires
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
