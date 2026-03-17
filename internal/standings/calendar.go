package standings

import (
	"encoding/json"
	"fmt"
	"os"
)

// Match représente une rencontre dans le calendrier.
type Match struct {
	Heure    string `json:"heure"`
	Domicile string `json:"domicile"`
	Visiteur string `json:"visiteur"`
	ScoreDom *int   `json:"score_dom"`
	ScoreVis *int   `json:"score_vis"`
	Joue     bool   `json:"joue"`
}

// Journee regroupe les matchs d'une date.
type Journee struct {
	Date   string  `json:"date"`
	Matchs []Match `json:"matchs"`
}

// Calendrier est la structure racine du fichier JSON produit par scraper_calendrier.py.
type Calendrier struct {
	Phase     string    `json:"phase"`
	Poule     string    `json:"poule"`
	ScrapedAt string    `json:"scraped_at"`
	Journees  []Journee `json:"journees"`
}

// LoadCalendrier lit un fichier JSON de calendrier.
func LoadCalendrier(path string) (*Calendrier, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("opening %s: %w", path, err)
	}
	defer f.Close()

	var c Calendrier
	if err := json.NewDecoder(f).Decode(&c); err != nil {
		return nil, fmt.Errorf("decoding %s: %w", path, err)
	}
	return &c, nil
}

// AllMatches retourne tous les matchs du calendrier à plat.
func (c *Calendrier) AllMatches() []Match {
	var all []Match
	for _, j := range c.Journees {
		all = append(all, j.Matchs...)
	}
	return all
}
