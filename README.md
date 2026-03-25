# Basketball Simulation

> **Projet fan en bêta** — fait par un passionné de basketball, dans l'objectif d'aider les joueurs, coachs et supporters à mieux suivre leur championnat. N'hésitez pas à [proposer de nouvelles fonctionnalités](https://github.com/NathanPrats/basketball-simulation/issues) !

Tableau de bord d'analyse des compétitions de basketball de la Fédération Française de Basketball (FFBB).

Le projet scrappe en temps réel les classements et calendriers depuis le site officiel `competitions.ffbb.com`, et les expose via une API Go. Un frontend Next.js permet de visualiser les classements, simuler des scénarios de fin de saison et calculer des projections statistiques.

**Live** : [basketball-simulation.vercel.app](https://basketball-simulation.vercel.app)
**API** : [basketball-simulation.onrender.com](https://basketball-simulation.onrender.com)
**Contact** : [nathan.prats.pro@gmail.com](mailto:nathan.prats.pro@gmail.com) · [LinkedIn](https://www.linkedin.com/in/nathan-prats/)

> **Avertissement** : Ce projet est un outil fan **non officiel**, sans affiliation avec la FFBB. La FFBB reste propriétaire de ses données, contenus et marques déposées. Les données affichées ne sont pas stockées : elles sont récupérées en temps réel depuis `competitions.ffbb.com` et mises en cache 1 heure maximum. Le scraper respecte le `Crawl-delay: 1` indiqué dans le `robots.txt` du site.

## Fonctionnalités

- **Classement enrichi** — probabilités de montée/relégation via simulation Monte Carlo (10M itérations)
- **Simulateur de scénarios** — forcer des résultats et voir l'impact sur le classement en temps réel, avec choix d'écart de points
- **Partage d'image** — générer une carte 1080×1080 à partager sur les réseaux sociaux
- **Indicateurs** — forme récente, difficulté du calendrier restant, "maître de leur destin"
- **Multi-compétitions** — ajout de n'importe quel championnat FFBB via son URL

## Architecture

Le projet est un monorepo composé de deux parties indépendantes :

- **`cmd/api/`** — serveur HTTP Go qui scrappe le site FFBB à la demande, met les données en cache mémoire (TTL 1h) et expose une API REST
- **`web/`** — frontend Next.js qui consomme l'API via un proxy rewrite

```
basketball-simulation/
├── cmd/api/main.go       # Point d'entrée de l'API
├── internal/
│   ├── scraper/          # Scraping HTML + RSC payload → structs Go
│   ├── standings/        # Modèles, simulation Monte Carlo
│   └── cache/            # Cache mémoire TTL
├── web/                  # Frontend Next.js
│   ├── app/              # Pages (App Router)
│   │   ├── [id]/         # Page classement + simulateur
│   │   └── a-propos/     # Page À propos
│   └── lib/              # Utilitaires API
└── Makefile
```

## Développement local

### Prérequis

- Go 1.22+
- Node.js 18+

### Lancer les deux en parallèle

```bash
make dev
```

### Séparément

```bash
# API (port 8080)
make run

# Frontend (port 3000)
cd web && npm install && npm run dev
```

## API

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/competitions` | Liste des compétitions |
| `POST` | `/api/competitions/scrape` | Ajouter une compétition via URL FFBB |
| `GET` | `/api/competitions/{id}/standings` | Classement |
| `GET` | `/api/competitions/{id}/calendar` | Calendrier |
| `GET` | `/api/competitions/{id}/projections` | Projections de fin de saison |
| `POST` | `/api/competitions/{id}/simulate` | Simulation avec résultats forcés |
| `POST` | `/api/competitions/{id}/refresh` | Forcer un re-scrape |

## Déploiement

- **Frontend** : Vercel — Root Directory `web`, variable d'env `NEXT_PUBLIC_API_URL=https://basketball-simulation.onrender.com`
- **API** : Render — Root Directory `cmd/api`, Start Command `./app -port $PORT`

## Licence

Ce projet est publié sous licence [MIT](LICENSE). Les données affichées appartiennent à la FFBB.
