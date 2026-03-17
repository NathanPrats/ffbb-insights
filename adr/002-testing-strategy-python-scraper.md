# ADR-002 : Stratégie de test du scraper Python

- **Date** : 2026-03-17
- **Statut** : Accepté

## Contexte

Le scraper Python (`scraper.py`) est dépendant de la structure interne du site `competitions.ffbb.com`, une application Next.js utilisant les React Server Components (RSC). Deux sources de fragilité sont identifiées :

1. **Le format des chunks RSC** peut changer à chaque mise à jour du framework ou du site.
2. **Les noms de champs** dans le payload (`rang`, `equipe`, `pts`…) peuvent être renommés sans préavis.

Le scraper comportait initialement une stratégie de fallback en trois couches : parsing RSC → Playwright → données hardcodées. Cette dernière couche est problématique : elle masque silencieusement une panne réelle en retournant des données périmées.

## Décision

### 1. Suppression du fallback en données hardcodées

Le fallback statique est supprimé. Si les deux couches de parsing (RSC et Playwright) échouent, le scraper lève une exception explicite. Une application qui signale clairement un problème est préférable à une application qui retourne silencieusement des données obsolètes.

### 2. Tests unitaires sur fixtures HTML (offline)

On sauvegarde une vraie réponse HTTP dans un fichier de fixture versionné dans le repo. Les tests unitaires tournent exclusivement sur cette fixture — aucun accès réseau requis. Ces tests font partie de la suite normale et sont exécutés en CI.

Fonctions couvertes :
- `looks_like_team()` — détection d'un objet équipe dans le payload RSC
- `normalize_team()` — mapping des noms de champs vers la forme canonique
- `extract_from_rsc_payload()` — extraction des équipes depuis un chunk RSC
- `extract_standings_from_rsc()` — pipeline de parsing complet sur la fixture

Structure attendue :
```
tests/
  fixtures/
    classement_rsc_response.html   # réponse HTTP réelle capturée et versionnée
  test_scraper.py                  # tests unitaires offline
```

### 3. Tests canary sur réseau réel (manuels)

Un marqueur `@pytest.mark.canary` isole les tests qui appellent le vrai site. Ils ne sont **pas** exécutés en CI ; ils se lancent manuellement pour vérifier qu'une mise à jour du site n'a pas cassé le parsing :

```bash
pytest -m canary
```

Tests canary couverts :
- La page retourne bien des chunks RSC (`self.__next_f.push` présent dans la réponse)
- Le parsing RSC extrait au moins 8 équipes
- Chaque équipe contient les champs attendus (`rang`, `equipe`, `pts`, `gagnes`, `perdus`, `bp`, `bc`)

## Alternatives écartées

**Validation de schéma embarquée (jsonschema / pydantic)**
Ajouter une validation stricte du JSON produit à chaque exécution du scraper. Écarté car le projet est à un stade où ce niveau de rigueur n'est pas justifié ; la couverture apportée par les tests unitaires et canary est suffisante.

**Tests canary en CI sur cron**
Exécuter les tests réseau automatiquement sur un planning (ex. hebdomadaire). Écarté pour l'instant au profit du déclenchement manuel, plus simple à maintenir à ce stade du projet.

## Conséquences

- La fixture HTML devra être mise à jour manuellement si le format RSC du site change de manière incompatible.
- La suppression du fallback hardcodé rend les pannes de parsing visibles immédiatement, ce qui est le comportement voulu.
- Les tests canary constituent le filet de sécurité pour détecter les changements côté FFBB avant qu'ils n'atteignent la production.
