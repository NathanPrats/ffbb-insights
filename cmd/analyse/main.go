package main

import (
	"flag"
	"fmt"
	"log"
	"os"

	"ffbb-insights/internal/standings"
)

func main() {
	input := flag.String("input", "data/dm1.json", "Fichier JSON du classement")
	flag.Parse()

	c, err := standings.Load(*input)
	if err != nil {
		log.Fatalf("Erreur chargement: %v", err)
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

	os.Exit(0)
}
