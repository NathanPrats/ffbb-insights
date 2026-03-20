GO       := go
ANALYSE  := ./cmd/analyse
API      := ./cmd/api
API_PORT ?= 8080

.PHONY: build build-api dev help

## Compile le binaire Go d'analyse CLI
build:
	$(GO) build -o bin/analyse $(ANALYSE)

## Compile le serveur API Go
build-api:
	$(GO) build -o bin/api $(API)

## Démarre l'API Go + le frontend Next.js en dev
dev: build-api
	./bin/api --port $(API_PORT) & cd web && npm run dev

help:
	@echo ""
	@echo "Usage:"
	@echo "  make build-api          # Compile le serveur API Go"
	@echo "  make dev                # Démarre API Go (port $(API_PORT)) + frontend Next.js"
	@echo "  make build              # Compile le binaire CLI analyse"
	@echo ""
	@echo "Variables:"
	@echo "  API_PORT = $(API_PORT)"
	@echo ""
