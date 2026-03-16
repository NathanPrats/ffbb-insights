# ffbb-insights

Outils d'analyse des classements de la Fédération Française de Basketball (FFBB) — Île-de-France.

## Structure

```
ffbb-insights/
├── scraper.py          # Scraper Python (FFBB → JSON)
├── Makefile            # Orchestration des commandes
├── go.mod
├── data/
│   └── dm1.json        # Classement PRM Poule A (généré)
├── cmd/
│   └── analyse/
│       └── main.go     # CLI d'analyse Go
└── internal/
    └── standings/
        ├── model.go    # Structs + méthodes (Diff, WinRate)
        ├── loader.go   # Chargement du JSON
        └── analysis.go # Fonctions d'analyse (TopN, BestOffense, …)
```

## Prérequis

- Python 3.9+ avec `pip install requests`
- Go 1.22+

## Utilisation

### Scraper

```bash
# Génère data/dm1.json (valeurs par défaut : PRM Poule A)
make dm1

# Poule / phase custom
make scrape PHASE=<id_phase> POULE=<id_poule>

# Fichier de sortie custom
make scrape PHASE=xxx POULE=yyy OUTPUT=data/dm2.json
```

### Analyse Go

```bash
# Compile + analyse data/dm1.json
make analyse

# Analyse un autre fichier
make analyse INPUT=data/dm2.json

# Compiler seulement
make build
```

### Aide

```bash
make help
```

## Format JSON produit

```json
{
  "competition": "Pré Régionale Masculine (PRM)",
  "ligue": "Île-de-France",
  "comite": "0078",
  "phase": "200000002872715",
  "poule": "200000003018348",
  "source_url": "...",
  "scraped_at": "2026-03-16",
  "classement": [
    {
      "rang": 1,
      "equipe": "ENTENTE LE CHESNAY VERSAILLES 78 BASKET - 2",
      "pts": 29,
      "joues": 16,
      "gagnes": 13,
      "perdus": 3,
      "nuls": 0,
      "bp": 1208,
      "bc": 1054,
      "penalites": 0
    }
  ]
}
```
