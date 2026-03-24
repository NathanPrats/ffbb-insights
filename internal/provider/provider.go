// Package provider définit l'interface d'acquisition des données de compétition.
// Voir ADR-004 pour le contexte et la stratégie de remplacement.
package provider

import "context"

// CompetitionMeta contient les métadonnées d'une compétition fraîchement acquise.
type CompetitionMeta struct {
	ID          string `json:"id"`
	Competition string `json:"competition"`
	Ligue       string `json:"ligue"`
	ScrapedAt   string `json:"scraped_at"`
}

// CompetitionProvider acquiert classement + calendrier depuis une URL FFBB,
// persiste les données dans dataDir/<slug>/ et retourne les métadonnées.
//
// Implémentations :
//   - PythonPipelineProvider : appelle ffbb_pipeline.py (scraping HTML)
//   - FFBBAPIProvider        : appelle l'API officielle FFBB (à venir)
type CompetitionProvider interface {
	Fetch(ctx context.Context, ffbbURL string) (CompetitionMeta, error)
}
