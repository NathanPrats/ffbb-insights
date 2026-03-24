package provider

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// PythonPipelineProvider implémente CompetitionProvider via ffbb_pipeline.py.
// Remplacer par FFBBAPIProvider dès qu'une clé API FFBB est disponible (ADR-004).
type PythonPipelineProvider struct {
	// ProjectRoot est le répertoire racine du projet (là où ffbb_pipeline.py et .venv/ se trouvent).
	ProjectRoot string
	// DataDir est le répertoire de sortie des données JSON (ex: "data").
	DataDir string
}

func (p *PythonPipelineProvider) Fetch(ctx context.Context, ffbbURL string) (CompetitionMeta, error) {
	slug, err := slugFromURL(ffbbURL)
	if err != nil {
		return CompetitionMeta{}, err
	}

	python := filepath.Join(p.ProjectRoot, ".venv", "bin", "python3")
	script := filepath.Join(p.ProjectRoot, "ffbb_pipeline.py")

	cmd := exec.CommandContext(ctx, python, script, "--url", ffbbURL)
	cmd.Dir = p.ProjectRoot
	out, err := cmd.CombinedOutput()
	if err != nil {
		return CompetitionMeta{}, fmt.Errorf("scraping échoué : %s", sanitizeOutput(out))
	}

	meta, err := p.readMeta(slug)
	if err != nil {
		return CompetitionMeta{}, fmt.Errorf("données introuvables après scraping : %w", err)
	}
	return meta, nil
}

// readMeta charge classement.json pour construire CompetitionMeta.
func (p *PythonPipelineProvider) readMeta(slug string) (CompetitionMeta, error) {
	path := filepath.Join(p.ProjectRoot, p.DataDir, slug, "classement.json")
	f, err := os.Open(path)
	if err != nil {
		return CompetitionMeta{}, err
	}
	defer f.Close()

	var cl struct {
		Competition string `json:"competition"`
		Ligue       string `json:"ligue"`
		ScrapedAt   string `json:"scraped_at"`
	}
	if err := json.NewDecoder(f).Decode(&cl); err != nil {
		return CompetitionMeta{}, err
	}
	return CompetitionMeta{
		ID:          slug,
		Competition: cl.Competition,
		Ligue:       cl.Ligue,
		ScrapedAt:   cl.ScrapedAt,
	}, nil
}

// slugFromURL extrait le slug "ligue-competition" d'une URL FFBB.
// Miroir de parse_ffbb_url() dans ffbb_rsc.py.
func slugFromURL(rawURL string) (string, error) {
	u, err := url.Parse(rawURL)
	if err != nil || !strings.Contains(u.Host, "competitions.ffbb.com") {
		return "", fmt.Errorf("URL invalide — domaine attendu : competitions.ffbb.com (http ou https)")
	}
	q := u.Query()
	if q.Get("phase") == "" || q.Get("poule") == "" {
		return "", fmt.Errorf("URL invalide — paramètres phase et poule requis")
	}

	segments := strings.Split(strings.Trim(u.Path, "/"), "/")
	ligue := segmentAfter(segments, "ligues")
	competition := segmentAfter(segments, "competitions")
	if ligue == "" || competition == "" {
		return "", fmt.Errorf("URL invalide — ligue ou compétition introuvable dans le chemin")
	}
	return strings.ToLower(ligue + "-" + competition), nil
}

func segmentAfter(segments []string, key string) string {
	for i, s := range segments {
		if s == key && i+1 < len(segments) {
			return segments[i+1]
		}
	}
	return ""
}

// sanitizeOutput tronque la sortie Python pour éviter des messages d'erreur trop longs.
func sanitizeOutput(out []byte) string {
	s := strings.TrimSpace(string(out))
	lines := strings.Split(s, "\n")
	// Garder uniquement les lignes d'erreur (Traceback, Error, Exception)
	var errLines []string
	for _, l := range lines {
		if strings.Contains(l, "Error") || strings.Contains(l, "Exception") || strings.Contains(l, "Traceback") {
			errLines = append(errLines, strings.TrimSpace(l))
		}
	}
	if len(errLines) > 0 {
		return strings.Join(errLines, " — ")
	}
	// Fallback : dernières 2 lignes
	if len(lines) > 2 {
		lines = lines[len(lines)-2:]
	}
	return strings.Join(lines, " — ")
}
