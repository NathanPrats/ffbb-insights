PYTHON     := python3
GO         := go
SCRAPER    := scraper.py
ANALYSE    := ./cmd/analyse

# Valeurs par défaut (DM1 - Pré Régionale Masculine, Poule A)
PHASE      ?= 200000002872715
POULE      ?= 200000003018348
OUTPUT     ?= data/dm1.json
INPUT      ?= data/dm1.json

.PHONY: scrape dm1 build analyse install help

## Scrape le classement avec les paramètres PHASE, POULE et OUTPUT
scrape:
	$(PYTHON) $(SCRAPER) --phase $(PHASE) --poule $(POULE) --output $(OUTPUT)

## Raccourci pour générer data/dm1.json avec les valeurs par défaut
dm1:
	$(PYTHON) $(SCRAPER) --phase $(PHASE) --poule $(POULE) --output data/dm1.json

## Compile le binaire Go d'analyse
build:
	$(GO) build -o bin/analyse $(ANALYSE)

## Compile et lance l'analyse sur INPUT (défaut: data/dm1.json)
analyse: build
	./bin/analyse --input $(INPUT)

## Installe les dépendances
install:
	pip3 install requests

help:
	@echo ""
	@echo "Usage:"
	@echo "  make dm1                          # Scrape → data/dm1.json (valeurs par défaut)"
	@echo "  make scrape PHASE=xxx POULE=yyy   # Scrape avec paramètres custom"
	@echo "  make scrape OUTPUT=data/dm2.json  # Fichier de sortie custom"
	@echo "  make build                        # Compile le binaire Go"
	@echo "  make analyse                      # Lance l'analyse sur data/dm1.json"
	@echo "  make analyse INPUT=data/dm2.json  # Lance l'analyse sur un autre fichier"
	@echo ""
	@echo "Variables:"
	@echo "  PHASE  = $(PHASE)"
	@echo "  POULE  = $(POULE)"
	@echo "  OUTPUT = $(OUTPUT)"
	@echo "  INPUT  = $(INPUT)"
	@echo ""
