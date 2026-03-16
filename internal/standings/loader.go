package standings

import (
	"encoding/json"
	"fmt"
	"os"
)

// Load lit un fichier JSON produit par le scraper et retourne le classement.
func Load(path string) (*Classement, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("opening %s: %w", path, err)
	}
	defer f.Close()

	var c Classement
	if err := json.NewDecoder(f).Decode(&c); err != nil {
		return nil, fmt.Errorf("decoding %s: %w", path, err)
	}
	return &c, nil
}
