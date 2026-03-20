GO       := go
ANALYSE  := ./cmd/analyse
API      := ./cmd/api
API_PORT ?= 8080

.PHONY: build build-api dev restart help

## Compile le binaire Go d'analyse CLI
build:
	$(GO) build -o bin/analyse $(ANALYSE)

## Compile le serveur API Go
build-api:
	$(GO) build -o bin/api $(API)

## Démarre l'API Go + le frontend Next.js en dev
dev: build-api
	./bin/api --port $(API_PORT) & cd web && npm run dev

## Rebuild et redémarre uniquement l'API (vide le cache)
restart: build-api
	@lsof -ti :$(API_PORT) | xargs kill -9 2>/dev/null || true
	@./bin/api --port $(API_PORT) &
	@echo "API redémarrée sur :$(API_PORT)"

help:
	@echo ""
	@echo "Usage:"
	@echo "  make build-api          # Compile le serveur API Go"
	@echo "  make dev                # Démarre API Go (port $(API_PORT)) + frontend Next.js"
	@echo "  make restart            # Rebuild + redémarre l'API seule (vide le cache)"
	@echo "  make build              # Compile le binaire CLI analyse"
	@echo ""
	@echo "Variables:"
	@echo "  API_PORT = $(API_PORT)"
	@echo ""
