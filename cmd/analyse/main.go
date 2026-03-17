package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"strconv"

	"ffbb-insights/internal/standings"
)

func main() {
	input := flag.String("input", "data/dm1.json", "Fichier JSON du classement")
	calendrier := flag.String("calendrier", "data/calendrier.json", "Fichier JSON du calendrier")
	flag.Parse()

	c, err := standings.Load(*input)
	if err != nil {
		log.Fatalf("Erreur chargement classement: %v", err)
	}

	fmt.Printf("=== %s — %s ===\n\n", c.Competition, c.Ligue)
	fmt.Printf("Phase: %s | Poule: %s | Scraped: %s\n\n", c.Phase, c.Poule, c.ScrapedAt)

	fmt.Println("--- Classement ---")
	for _, t := range c.Teams {
		fmt.Printf("  %2d. %-50s %2d pts  %d/%d/%d  diff %+d  (%.0f%% win)\n",
			t.Rang, t.Equipe, t.Pts,
			t.Gagnes, t.Perdus, t.Nuls,
			t.Diff(), t.WinRate(),
		)
	}

	fmt.Println()
	off := standings.BestOffense(c.Teams)
	def := standings.BestDefense(c.Teams)
	dif := standings.BestDiff(c.Teams)
	fmt.Printf("Meilleure attaque : %s (%d BP)\n", off.Equipe, off.BP)
	fmt.Printf("Meilleure défense : %s (%d BC)\n", def.Equipe, def.BC)
	fmt.Printf("Meilleur diff     : %s (%+d)\n", dif.Equipe, dif.Diff())

	// --- Projections championnat ---
	cal, err := standings.LoadCalendrier(*calendrier)
	if err != nil {
		fmt.Printf("\n(Projections indisponibles : %v)\n", err)
		os.Exit(0)
	}

	fmt.Printf("\n--- Projections championnat (%dM simulations, départage : confrontation directe puis différentiel) ---\n\n",
		standings.NSimulations/1_000_000)

	projections := standings.SimulateChampionship(c.Teams, cal.AllMatches())

	fmt.Printf("  %-50s  %3s  %3s  %-38s  %s\n", "Équipe", "Pts", "Max", "Scénarios 1er place", "%")
	fmt.Printf("  %s\n", repeatStr("-", 107))

	for _, p := range projections {
		scenStr := formatCount(p.EstimatedScenarios) + " / " + formatCount(p.TotalScenarios)
		suffix := ""
		if p.EstimatedScenarios == 0 {
			suffix = "  éliminé"
		}
		fmt.Printf("  %-50s  %3d  %3d  %-38s  %5.1f%%%s\n",
			p.Team.Equipe, p.Team.Pts, p.MaxPts, scenStr, p.WinPct, suffix)
	}

	os.Exit(0)
}

// formatCount formate un int64 avec des espaces comme séparateurs de milliers.
func formatCount(n int64) string {
	s := strconv.FormatInt(n, 10)
	result := make([]byte, 0, len(s)+len(s)/3)
	for i, c := range []byte(s) {
		if i > 0 && (len(s)-i)%3 == 0 {
			result = append(result, ' ')
		}
		result = append(result, c)
	}
	return string(result)
}

func repeatStr(s string, n int) string {
	result := make([]byte, n*len(s))
	for i := range n {
		copy(result[i*len(s):], s)
	}
	return string(result)
}
