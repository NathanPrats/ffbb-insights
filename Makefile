PYTHON     := .venv/bin/python3
GO         := go
ANALYSE    := ./cmd/analyse
API        := ./cmd/api
API_PORT   ?= 8080

# Valeurs par défaut (DM1 - Pré Régionale Masculine, Poule A)
PHASE      ?= 200000002872715
POULE      ?= 200000003018348
OUTPUT     ?= data/idf-dm3/dm1.json
INPUT      ?= data/dm1.json
CALENDRIER ?= data/calendrier.json

# Pipeline URL (ex: make pipeline URL="https://competitions.ffbb.com/.../classement?phase=X&poule=Y")
URL        ?=

.PHONY: pipeline classement calendrier dm1 build build-api dev analyse test install help

## Pipeline complet depuis une URL FFBB (scraping + analyse)
pipeline: build
	$(PYTHON) ffbb_pipeline.py --url "$(URL)" --analyse

## Scrape le classement avec les paramètres PHASE, POULE et OUTPUT
classement:
	$(PYTHON) scraper_classement.py --phase $(PHASE) --poule $(POULE) --output $(OUTPUT)

## Scrape le calendrier complet de la saison
calendrier:
	$(PYTHON) scraper_calendrier.py --phase $(PHASE) --poule $(POULE) --output data/calendrier.json

## Compile le binaire Go d'analyse
build:
	$(GO) build -o bin/analyse $(ANALYSE)

## Compile le serveur API Go
build-api:
	$(GO) build -o bin/api $(API)

## Démarre l'API Go + le frontend Next.js en dev
dev: build-api
	./bin/api --port $(API_PORT) & cd web && npm run dev

## Compile et lance l'analyse sur INPUT (défaut: data/dm1.json)
analyse: build
	./bin/analyse --input $(INPUT) --calendrier $(CALENDRIER)

## Lance les tests unitaires Python
test:
	.venv/bin/pytest tests/ -v

## Crée le venv et installe les dépendances Python
install:
	python3 -m venv .venv
	.venv/bin/pip install requests pytest

help:
	@echo ""
	@echo "Usage:"
	@echo "  make pipeline URL=\"https://competitions.ffbb.com/.../classement?phase=X&poule=Y\""
	@echo "                                    # Pipeline complet : scraping + analyse (dossier auto)"
	@echo "  make dm1                          # Scrape classement → data/dm1.json (valeurs par défaut)"
	@echo "  make classement PHASE=xxx POULE=yyy OUTPUT=data/dm2.json"
	@echo "  make calendrier                   # Scrape calendrier → data/calendrier.json"
	@echo "  make build                        # Compile le binaire Go (CLI analyse)"
	@echo "  make build-api                    # Compile le serveur API Go"
	@echo "  make dev                          # Démarre API Go + frontend Next.js"
	@echo "  make analyse                      # Lance l'analyse sur data/dm1.json"
	@echo "  make analyse INPUT=data/dm2.json  # Lance l'analyse sur un autre fichier"
	@echo "  make test                         # Lance les tests unitaires"
	@echo ""
	@echo "Variables:"
	@echo "  URL    = $(URL)"
	@echo "  PHASE  = $(PHASE)"
	@echo "  POULE  = $(POULE)"
	@echo "  OUTPUT = $(OUTPUT)"
	@echo "  INPUT  = $(INPUT)"
	@echo ""
