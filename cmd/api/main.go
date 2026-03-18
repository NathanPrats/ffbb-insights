package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"ffbb-insights/internal/standings"
)

var suffixRe = regexp.MustCompile(` - \d+$`)

var dataDir string

func main() {
	port := flag.String("port", "8080", "Port d'écoute")
	flag.StringVar(&dataDir, "data", "data", "Répertoire des données JSON")
	flag.Parse()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/competitions", handleCompetitions)
	mux.HandleFunc("GET /api/competitions/{id}/standings", handleStandings)
	mux.HandleFunc("GET /api/competitions/{id}/calendar", handleCalendar)
	mux.HandleFunc("GET /api/competitions/{id}/projections", handleProjections)
	mux.HandleFunc("POST /api/competitions/{id}/simulate", handleSimulate)

	handler := corsMiddleware(mux)

	log.Printf("API listening on :%s (data: %s)", *port, dataDir)
	if err := http.ListenAndServe(":"+*port, handler); err != nil {
		log.Fatal(err)
	}
}

// --- Handlers ---

func handleCompetitions(w http.ResponseWriter, r *http.Request) {
	entries, err := os.ReadDir(dataDir)
	if err != nil {
		httpError(w, fmt.Sprintf("cannot read data dir: %v", err), http.StatusInternalServerError)
		return
	}

	type Competition struct {
		ID          string `json:"id"`
		Competition string `json:"competition"`
		Ligue       string `json:"ligue"`
		ScrapedAt   string `json:"scraped_at"`
	}

	var comps []Competition
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		cl, err := loadStandings(e.Name())
		if err != nil {
			continue
		}
		comps = append(comps, Competition{
			ID:          e.Name(),
			Competition: cl.Competition,
			Ligue:       cl.Ligue,
			ScrapedAt:   cl.ScrapedAt,
		})
	}
	jsonOK(w, comps)
}

func handleStandings(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	cl, err := loadStandings(id)
	if err != nil {
		httpError(w, err.Error(), http.StatusNotFound)
		return
	}
	cal, _ := loadCalendrier(id) // optionnel

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
	cal, err := loadCalendrier(id)
	if err != nil {
		httpError(w, err.Error(), http.StatusNotFound)
		return
	}
	jsonOK(w, cal)
}

func handleProjections(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	top, bottom := parseTopBottom(r)

	cl, err := loadStandings(id)
	if err != nil {
		httpError(w, err.Error(), http.StatusNotFound)
		return
	}
	cal, err := loadCalendrier(id)
	if err != nil {
		httpError(w, "calendrier introuvable: "+err.Error(), http.StatusNotFound)
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

	cl, err := loadStandings(id)
	if err != nil {
		httpError(w, err.Error(), http.StatusNotFound)
		return
	}
	cal, err := loadCalendrier(id)
	if err != nil {
		httpError(w, "calendrier introuvable: "+err.Error(), http.StatusNotFound)
		return
	}

	// Appliquer les overrides : transformer les matchs forcés en matchs joués
	allMatches := applyOverrides(cal.AllMatches(), req.Overrides)

	// Ajuster le classement de base avec les résultats forcés
	// (SimulateChampionship initialise ses états depuis teams — sans ce correctif,
	// le vainqueur forcé ne gagnerait pas ses +2 pts dans la simulation)
	adjustedTeams := applyOverridesToTeams(cl.Teams, req.Overrides)

	targets := req.TargetPositions
	if len(targets) == 0 {
		targets = []int{1}
	}

	results := standings.SimulateChampionship(adjustedTeams, allMatches, targets)
	jsonOK(w, results)
}

// --- Helpers ---

func loadStandings(id string) (*standings.Classement, error) {
	return standings.Load(filepath.Join(dataDir, id, "classement.json"))
}

func loadCalendrier(id string) (*standings.Calendrier, error) {
	return standings.LoadCalendrier(filepath.Join(dataDir, id, "calendrier.json"))
}

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

// applyOverridesToTeams retourne une copie du classement avec les pts/stats mis à jour
// pour chaque match forcé. Sans ça, SimulateChampionship ignorerait les +2 pts du vainqueur.
func applyOverridesToTeams(teams []standings.Team, overrides []MatchOverride) []standings.Team {
	adjusted := make([]standings.Team, len(teams))
	copy(adjusted, teams)

	// Index nom normalisé → indice (même normalisation que projection.go)
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

		// Scores fixes (identiques à applyOverrides)
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

// applyOverrides marque les matchs forcés comme joués avec le vainqueur spécifié.
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
