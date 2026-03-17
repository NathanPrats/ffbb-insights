PYTHON     := .venv/bin/python3
GO         := go
ANALYSE    := ./cmd/analyse

# Valeurs par défaut (DM1 - Pré Régionale Masculine, Poule A)
PHASE      ?= 200000002872715
POULE      ?= 200000003018348
OUTPUT     ?= data/dm1.json
INPUT      ?= data/dm1.json
CALENDRIER ?= data/calendrier.json

.PHONY: classement calendrier dm1 build analyse test install help

## Scrape le classement avec les paramètres PHASE, POULE et OUTPUT
classement:
	$(PYTHON) scraper_classement.py --phase $(PHASE) --poule $(POULE) --output $(OUTPUT)

## Raccourci pour générer data/dm1.json avec les valeurs par défaut
dm1:
	$(PYTHON) scraper_classement.py --phase $(PHASE) --poule $(POULE) --output data/dm1.json

## Scrape le calendrier complet de la saison
calendrier:
	$(PYTHON) scraper_calendrier.py --phase $(PHASE) --poule $(POULE) --output data/calendrier.json

## Compile le binaire Go d'analyse
build:
	$(GO) build -o bin/analyse $(ANALYSE)

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
	@echo "  make dm1                          # Scrape classement → data/dm1.json (valeurs par défaut)"
	@echo "  make classement PHASE=xxx POULE=yyy OUTPUT=data/dm2.json"
	@echo "  make calendrier                   # Scrape calendrier → data/calendrier.json"
	@echo "  make calendrier PHASE=xxx POULE=yyy"
	@echo "  make build                        # Compile le binaire Go"
	@echo "  make analyse                      # Lance l'analyse sur data/dm1.json"
	@echo "  make analyse INPUT=data/dm2.json  # Lance l'analyse sur un autre fichier"
	@echo "  make test                         # Lance les tests unitaires"
	@echo ""
	@echo "Variables:"
	@echo "  PHASE  = $(PHASE)"
	@echo "  POULE  = $(POULE)"
	@echo "  OUTPUT = $(OUTPUT)"
	@echo "  INPUT  = $(INPUT)"
	@echo ""
