package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"ffbb-insights/internal/cache"
	"ffbb-insights/internal/scraper"
	"ffbb-insights/internal/standings"
)

// ── Competition registry ──────────────────────────────────────────────────────

// CompetitionConfig est la configuration statique d'une compétition connue.
// Les URLs contiennent les IDs phase/poule nécessaires au scraping.
type CompetitionConfig struct {
	ID            string
	Competition   string
	Ligue         string
	ClassementURL string
}

// competitions est la liste des compétitions disponibles dans l'application.
// Pour ajouter une compétition : copier l'URL FFBB de la page classement.
var competitions = []CompetitionConfig{
	{
		ID:            "idf-dm3",
		Competition:   "dm3",
		Ligue:         "idf",
		ClassementURL: "https://competitions.ffbb.com/ligues/idf/comites/0078/competitions/dm3/classement?phase=200000002873855&poule=200000003020596",
	},
	{
		ID:            "idf-pnm",
		Competition:   "pnm",
		Ligue:         "idf",
		ClassementURL: "https://competitions.ffbb.com/ligues/idf/competitions/pnm/classement?phase=200000002872906&poule=200000003018734",
	},
	{
		ID:            "idf-rm2",
		Competition:   "rm2",
		Ligue:         "idf",
		ClassementURL: "https://competitions.ffbb.com/ligues/idf/competitions/rm2/classement?phase=200000002872433&poule=200000003017522",
	},
	{
		ID:            "ara-rm3",
		Competition:   "rm3",
		Ligue:         "ara",
		ClassementURL: "https://competitions.ffbb.com/ligues/ara/competitions/rm3/classement?phase=200000002880055&poule=200000003035093",
	},
	{
		ID:            "-nm2",
		Competition:   "nm2",
		Ligue:         "",
		ClassementURL: "https://competitions.ffbb.com/competitions/nm2/classement?phase=200000002872459&poule=200000003017639",
	},
}

func findConfig(id string) (CompetitionConfig, bool) {
	for _, c := range competitions {
		if c.ID == id {
			return c, true
		}
	}
	return CompetitionConfig{}, false
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

var dataCache *cache.Cache

var suffixRe = regexp.MustCompile(` - \d+$`)

func main() {
	port := flag.String("port", "8080", "Port d'écoute")
	ttl := flag.Duration("cache-ttl", time.Hour, "Durée de vie du cache mémoire")
	flag.Parse()

	dataCache = cache.New(*ttl)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/competitions", handleCompetitions)
	mux.HandleFunc("GET /api/competitions/{id}/standings", handleStandings)
	mux.HandleFunc("GET /api/competitions/{id}/calendar", handleCalendar)
	mux.HandleFunc("GET /api/competitions/{id}/projections", handleProjections)
	mux.HandleFunc("POST /api/competitions/{id}/simulate", handleSimulate)
	mux.HandleFunc("POST /api/competitions/{id}/refresh", handleRefresh)

	handler := corsMiddleware(mux)

	log.Printf("API listening on :%s (cache TTL: %s)", *port, *ttl)
	if err := http.ListenAndServe(":"+*port, handler); err != nil {
		log.Fatal(err)
	}
}

// ── Data access ───────────────────────────────────────────────────────────────

// getOrFetch retourne les données d'une compétition depuis le cache,
// ou les scrape si le cache est vide/expiré.
func getOrFetch(id string) (*standings.Classement, *standings.Calendrier, error) {
	if entry, ok := dataCache.Get(id); ok {
		return entry.Classement, entry.Calendrier, nil
	}

	config, ok := findConfig(id)
	if !ok {
		return nil, nil, fmt.Errorf("compétition %q inconnue", id)
	}

	log.Printf("[scrape] %s — classement", id)
	cl, err := scraper.FetchStandings(config.ClassementURL)
	if err != nil {
		return nil, nil, fmt.Errorf("scrape classement %s: %w", id, err)
	}

	// Construire le filtre d'équipes pour les compétitions multi-poules
	teamFilter := make(map[string]bool, len(cl.Teams))
	for _, t := range cl.Teams {
		teamFilter[suffixRe.ReplaceAllString(t.Equipe, "")] = true
	}

	log.Printf("[scrape] %s — calendrier", id)
	cal, err := scraper.FetchCalendrier(config.ClassementURL, teamFilter)
	if err != nil {
		// Le calendrier est optionnel (standings fonctionne sans)
		log.Printf("[warn] calendrier %s: %v", id, err)
		cal = nil
	}

	dataCache.Set(id, cl, cal)
	return cl, cal, nil
}

// ── Handlers ──────────────────────────────────────────────────────────────────

func handleCompetitions(w http.ResponseWriter, r *http.Request) {
	type Competition struct {
		ID          string `json:"id"`
		Competition string `json:"competition"`
		Ligue       string `json:"ligue"`
	}
	comps := make([]Competition, 0, len(competitions))
	for _, c := range competitions {
		comps = append(comps, Competition{
			ID:          c.ID,
			Competition: c.Competition,
			Ligue:       c.Ligue,
		})
	}
	jsonOK(w, comps)
}

func handleStandings(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	cl, cal, err := getOrFetch(id)
	if err != nil {
		httpError(w, err.Error(), http.StatusNotFound)
		return
	}

	type Response struct {
		*standings.Classement
		RemainingMatches []standings.Match `json:"remaining_matches,omitempty"`
	}
	resp := Response{Classement: cl}
	if cal != nil {
		for _, m := range cal.AllMatches() {
			if !m.Joue {
				resp.RemainingMatches = append(resp.RemainingMatches, m)
			}
		}
	}
	jsonOK(w, resp)
}

func handleCalendar(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	_, cal, err := getOrFetch(id)
	if err != nil {
		httpError(w, err.Error(), http.StatusNotFound)
		return
	}
	if cal == nil {
		httpError(w, "calendrier indisponible", http.StatusNotFound)
		return
	}
	jsonOK(w, cal)
}

func handleProjections(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	top, bottom := parseTopBottom(r)

	cl, cal, err := getOrFetch(id)
	if err != nil {
		httpError(w, err.Error(), http.StatusNotFound)
		return
	}
	if cal == nil {
		httpError(w, "calendrier indisponible pour les projections", http.StatusNotFound)
		return
	}

	n := len(cl.Teams)
	targets := buildTargets(n, top, bottom)
	results := standings.SimulateChampionship(cl.Teams, cal.AllMatches(), targets)
	jsonOK(w, results)
}

type SimulateRequest struct {
	Overrides       []MatchOverride `json:"overrides"`
	TargetPositions []int           `json:"target_positions"`
}

type MatchOverride struct {
	Domicile string `json:"domicile"`
	Visiteur string `json:"visiteur"`
	Winner   string `json:"winner"` // "domicile" | "visiteur"
}

func handleSimulate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var req SimulateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, "invalid body: "+err.Error(), http.StatusBadRequest)
		return
	}

	cl, cal, err := getOrFetch(id)
	if err != nil {
		httpError(w, err.Error(), http.StatusNotFound)
		return
	}
	if cal == nil {
		httpError(w, "calendrier indisponible pour la simulation", http.StatusNotFound)
		return
	}

	allMatches := applyOverrides(cal.AllMatches(), req.Overrides)
	adjustedTeams := applyOverridesToTeams(cl.Teams, req.Overrides)

	targets := req.TargetPositions
	if len(targets) == 0 {
		targets = []int{1}
	}

	results := standings.SimulateChampionship(adjustedTeams, allMatches, targets)
	jsonOK(w, results)
}

// handleRefresh invalide le cache pour une compétition et force un re-scrape immédiat.
func handleRefresh(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if _, ok := findConfig(id); !ok {
		httpError(w, fmt.Sprintf("compétition %q inconnue", id), http.StatusNotFound)
		return
	}
	dataCache.Invalidate(id)
	log.Printf("[refresh] %s — cache invalidé", id)

	cl, _, err := getOrFetch(id)
	if err != nil {
		httpError(w, "scrape échoué: "+err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]string{
		"status":     "ok",
		"scraped_at": cl.ScrapedAt,
	})
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func parseTopBottom(r *http.Request) (top, bottom int) {
	top = 1
	if v := r.URL.Query().Get("top"); v != "" {
		fmt.Sscanf(v, "%d", &top)
	}
	if v := r.URL.Query().Get("bottom"); v != "" {
		fmt.Sscanf(v, "%d", &bottom)
		top = 0
	}
	return
}

func buildTargets(n, top, bottom int) []int {
	var targets []int
	if bottom > 0 {
		for i := n - bottom + 1; i <= n; i++ {
			targets = append(targets, i)
		}
	} else {
		for i := 1; i <= top; i++ {
			targets = append(targets, i)
		}
	}
	return targets
}

func applyOverridesToTeams(teams []standings.Team, overrides []MatchOverride) []standings.Team {
	adjusted := make([]standings.Team, len(teams))
	copy(adjusted, teams)

	nameToIdx := make(map[string]int, len(adjusted))
	for i, t := range adjusted {
		nameToIdx[normalize(suffixRe.ReplaceAllString(t.Equipe, ""))] = i
	}

	for _, o := range overrides {
		domIdx, domOk := nameToIdx[normalize(o.Domicile)]
		visIdx, visOk := nameToIdx[normalize(o.Visiteur)]
		if !domOk || !visOk {
			continue
		}

		domScore, visScore := 80, 70
		if o.Winner == "visiteur" {
			domScore, visScore = 70, 80
		}

		adjusted[domIdx].Joues++
		adjusted[visIdx].Joues++
		adjusted[domIdx].BP += domScore
		adjusted[domIdx].BC += visScore
		adjusted[visIdx].BP += visScore
		adjusted[visIdx].BC += domScore

		if o.Winner == "domicile" {
			adjusted[domIdx].Pts += 2
			adjusted[domIdx].Gagnes++
			adjusted[visIdx].Perdus++
		} else {
			adjusted[visIdx].Pts += 2
			adjusted[visIdx].Gagnes++
			adjusted[domIdx].Perdus++
		}
	}
	return adjusted
}

func applyOverrides(matches []standings.Match, overrides []MatchOverride) []standings.Match {
	type key struct{ dom, vis string }
	forced := make(map[key]string, len(overrides))
	for _, o := range overrides {
		forced[key{normalize(o.Domicile), normalize(o.Visiteur)}] = o.Winner
	}

	result := make([]standings.Match, len(matches))
	copy(result, matches)

	for i, m := range result {
		if m.Joue {
			continue
		}
		winner, ok := forced[key{normalize(m.Domicile), normalize(m.Visiteur)}]
		if !ok {
			continue
		}
		domScore, visScore := 80, 70
		if winner == "visiteur" {
			domScore, visScore = 70, 80
		}
		result[i].Joue = true
		result[i].ScoreDom = &domScore
		result[i].ScoreVis = &visScore
	}
	return result
}

func normalize(s string) string {
	return strings.TrimSpace(strings.ToLower(s))
}

func jsonOK(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(v)
}

func httpError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
