# ADR-004 : Abstraction de la couche d'acquisition des données de compétition

- **Date** : 2026-03-19
- **Statut** : Accepté

## Contexte

Pour afficher un championnat dans l'interface, il faut disposer de deux fichiers JSON dans
`data/<slug>/` : `classement.json` et `calendrier.json`. Aujourd'hui ces fichiers sont produits
par un pipeline Python (`ffbb_pipeline.py`) qui scrape le site `competitions.ffbb.com`.

La FFBB envisage d'exposer une API officielle. Dès qu'une clé sera disponible, le scraping
devrait être remplacé par des appels API directs — plus fiables, plus rapides, moins fragiles
aux changements de DOM.

L'interface web doit permettre d'ajouter un championnat à la volée via une barre de recherche
(ADR en cours). Le handler Go qui reçoit cette demande ne doit pas être couplé au mécanisme
d'acquisition (scraping Python aujourd'hui, API FFBB demain).

## Décision

On introduit une interface Go `CompetitionProvider` dans un nouveau package
`internal/provider` :

```go
type CompetitionMeta struct {
    ID          string // slug ex: "idf-dm3"
    Competition string
    Ligue       string
    ScrapedAt   string
}

type CompetitionProvider interface {
    // Fetch récupère classement + calendrier pour l'URL FFBB donnée,
    // persiste les données dans dataDir/<slug>/ et retourne les métadonnées.
    Fetch(ctx context.Context, ffbbURL string) (CompetitionMeta, error)
}
```

**Implémentation initiale : `PythonPipelineProvider`**

Appelle `.venv/bin/python3 ffbb_pipeline.py --url <url>` en sous-processus.
Lit ensuite `classement.json` pour construire `CompetitionMeta`.

**Implémentation future : `FFBBAPIProvider`** (non implémentée)

Appellera directement l'API FFBB avec la clé d'authentification.
Construira et écrira les mêmes fichiers JSON dans `data/<slug>/`.
Respectera exactement la même interface — zéro changement dans le handler.

Le handler `POST /api/scrape` reçoit le provider par injection dans le serveur :

```go
type server struct {
    dataDir  string
    provider provider.CompetitionProvider
}
```

## Alternatives écartées

**Appel Python inline dans le handler sans interface**
Simple à écrire, mais le jour où on veut basculer sur l'API FFBB, il faut modifier le handler
et risquer de casser le reste. L'interface coûte 20 lignes et isole complètement le changement.

**Provider configuré par variable d'environnement au runtime**
Trop tôt — on n'a pas encore la clé API. On switche en recompilant, ce qui est acceptable
pour un projet perso / petite équipe.

**Réécrire le scraping en Go**
Le scraper Python parse des chunks RSC (React Server Components) streamés dans le HTML.
C'est fragile et complexe. Réécrire en Go ne rapporte rien tant que l'API officielle n'existe
pas. Le Python reste cantonné derrière l'interface.

## Conséquences

- Nouveau package `internal/provider/` avec l'interface et l'implémentation Python.
- `cmd/api/main.go` instancie `PythonPipelineProvider` et l'injecte dans le serveur.
- Quand la clé FFBB est disponible : créer `FFBBAPIProvider`, changer une ligne dans `main.go`.
- Le handler `POST /api/scrape` et le frontend ne changent pas lors du switch.
- Les erreurs du provider (scraping raté, réseau, URL invalide) sont remontées explicitement
  au frontend avec un message lisible.
