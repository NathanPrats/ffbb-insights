package standings

// Team représente une équipe dans le classement.
type Team struct {
	Rang      int    `json:"rang"`
	Equipe    string `json:"equipe"`
	Pts       int    `json:"pts"`
	Joues     int    `json:"joues"`
	Gagnes    int    `json:"gagnes"`
	Perdus    int    `json:"perdus"`
	Nuls      int    `json:"nuls"`
	BP        int    `json:"bp"`
	BC        int    `json:"bc"`
	Penalites int    `json:"penalites"`
}

// Classement est la structure racine du fichier JSON produit par le scraper.
type Classement struct {
	Competition string `json:"competition"`
	Ligue       string `json:"ligue"`
	Comite      string `json:"comite"`
	Phase       string `json:"phase"`
	Poule       string `json:"poule"`
	SourceURL   string `json:"source_url"`
	ScrapedAt   string `json:"scraped_at"`
	Teams       []Team `json:"classement"`
}

// Diff est l'écart points marqués / points encaissés.
func (t Team) Diff() int {
	return t.BP - t.BC
}

// WinRate est le pourcentage de victoires (matchs joués > 0).
func (t Team) WinRate() float64 {
	if t.Joues == 0 {
		return 0
	}
	return float64(t.Gagnes) / float64(t.Joues) * 100
}
