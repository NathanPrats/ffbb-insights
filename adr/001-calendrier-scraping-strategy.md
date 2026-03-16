# ADR-001 : Stratégie de scraping du calendrier FFBB

- **Date** : 2026-03-16
- **Statut** : Accepté

## Contexte

Le site `competitions.ffbb.com` est une application Next.js (App Router) qui utilise les React Server Components (RSC) avec streaming. Les données ne sont pas dans le DOM HTML classique mais dans des chunks RSC sérialisés injectés via `self.__next_f.push(...)`.

La page calendrier est accessible via :
```
/ligues/idf/comites/0078/competitions/prm?phase=<id>&poule=<id>&jour=YYYY-MM-DD
```

Le paramètre `jour` est le seul mécanisme de navigation entre journées. Chaque page contient une barre de navigation avec toutes les dates de la saison rendues côté serveur dans le payload RSC.

## Décision

On retient **l'Option B : extraction de la liste des dates depuis le payload RSC**.

Le principe :
1. Faire un seul GET sur une page calendrier quelconque.
2. Parser le payload RSC pour extraire toutes les dates de la saison présentes dans la barre de navigation.
3. Itérer uniquement sur ces dates (estimé à ~30-40 dates avec matchs) pour extraire les matchs de chaque journée.

## Alternatives écartées

**Option A — Enumération naïve (itération sur tous les jours de la saison)**
Itérer sur ~240 jours (Sept 2025 → Mai 2026), ou ~90 si limité aux weekends. Simple mais génère beaucoup de requêtes inutiles sur des jours sans match.

**Option C — Playwright (browser headless)**
Fiable mais lent, complexe à maintenir, et introduit une dépendance lourde. Réservé en dernier recours si le parsing RSC s'avère impossible.

## Conséquences

- Le scraper devra résoudre les références croisées du payload RSC (format `$Lx`) pour extraire la liste de dates — travail identique à celui tenté pour le classement.
- Si le parsing RSC échoue à l'implémentation, on se repliera sur l'Option A (weekends uniquement) sans changer le modèle de données.
- Le JSON produit (`data/calendrier.json`) suivra ce format :

```json
{
  "phase": "200000002872715",
  "poule": "200000003018348",
  "scraped_at": "YYYY-MM-DD",
  "journees": [
    {
      "date": "2026-03-21",
      "matchs": [
        {
          "heure": "20:30",
          "domicile": "LES MUREAUX BC",
          "visiteur": "TUES GERMANOISE",
          "score_dom": 48,
          "score_vis": 75,
          "joue": true
        }
      ]
    }
  ]
}
```
