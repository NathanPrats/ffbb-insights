package standings

import (
	"math"
	"math/rand"
	"regexp"
	"runtime"
	"sync"
)

// NSimulations est le nombre de simulations Monte Carlo.
const NSimulations = 10_000_000

var teamSuffixRe = regexp.MustCompile(` - \d+$`)

// normalizeTeamName supprime le suffixe " - N" présent dans le classement
// mais absent du calendrier (ex. "MB GARGENVILLE - 1" → "MB GARGENVILLE").
func normalizeTeamName(name string) string {
	return teamSuffixRe.ReplaceAllString(name, "")
}

// ProjectionResult contient la projection championnat pour une équipe.
type ProjectionResult struct {
	Team               Team
	MaxPts             int
	EstimatedScenarios int64   // estimé par Monte Carlo × 2^N
	TotalScenarios     int64   // 2^N (N = matchs restants)
	WinPct             float64 // pourcentage de scénarios gagnants
}

// simTeam est l'état mutable d'une équipe pendant une simulation.
type simTeam struct {
	pts int
	bp  int
	bc  int
}

// pendingMatch stocke les scores pré-calculés pour un match à venir.
// homeWinScores[0] = score domicile, homeWinScores[1] = score visiteur si domicile gagne.
// awayWinScores[0] = score domicile, awayWinScores[1] = score visiteur si visiteur gagne.
type pendingMatch struct {
	homeIdx      int
	awayIdx      int
	homeWinScores [2]int
	awayWinScores [2]int
}

// computeExpectedScores estime les scores attendus d'un match en croisant
// la force offensive d'une équipe avec la faiblesse défensive de l'adversaire.
func computeExpectedScores(home, away Team) (expHome, expAway int) {
	avg := 75.0 // score moyen par défaut si pas de matchs joués

	homeOff := avg
	if home.Joues > 0 {
		homeOff = float64(home.BP) / float64(home.Joues)
	}
	homeDef := avg
	if home.Joues > 0 {
		homeDef = float64(home.BC) / float64(home.Joues)
	}
	awayOff := avg
	if away.Joues > 0 {
		awayOff = float64(away.BP) / float64(away.Joues)
	}
	awayDef := avg
	if away.Joues > 0 {
		awayDef = float64(away.BC) / float64(away.Joues)
	}

	expHome = int(math.Round((homeOff + awayDef) / 2))
	expAway = int(math.Round((awayOff + homeDef) / 2))
	return
}

// buildPendingMatch pré-calcule les deux scénarios de score (domicile gagne / visiteur gagne).
func buildPendingMatch(homeIdx, awayIdx int, home, away Team) pendingMatch {
	expH, expA := computeExpectedScores(home, away)

	// Scores si domicile gagne : s[0] > s[1]
	var homeWin [2]int
	if expH > expA {
		homeWin = [2]int{expH, expA}
	} else {
		homeWin = [2]int{expA + 1, expA}
	}

	// Scores si visiteur gagne : s[1] > s[0]
	var awayWin [2]int
	if expA > expH {
		awayWin = [2]int{expH, expA}
	} else {
		awayWin = [2]int{expH, expH + 1}
	}

	return pendingMatch{
		homeIdx:       homeIdx,
		awayIdx:       awayIdx,
		homeWinScores: homeWin,
		awayWinScores: awayWin,
	}
}

// SimulateChampionship lance NSimulations simulations Monte Carlo et retourne
// la projection championnat pour chaque équipe du classement.
func SimulateChampionship(teams []Team, allMatches []Match) []ProjectionResult {
	n := len(teams)

	// Index nom normalisé → indice équipe
	nameIdx := make(map[string]int, n)
	for i, t := range teams {
		nameIdx[normalizeTeamName(t.Equipe)] = i
	}

	// États de base
	var baseStates [12]simTeam
	for i, t := range teams {
		baseStates[i] = simTeam{pts: t.Pts, bp: t.BP, bc: t.BC}
	}

	// H2H des matchs déjà joués : h2hPlayed[i][j] = pts gagnés par i dans ses matchs vs j
	var h2hPlayed [12][12]int
	for _, m := range allMatches {
		if !m.Joue || m.ScoreDom == nil || m.ScoreVis == nil {
			continue
		}
		hi, hok := nameIdx[m.Domicile]
		ai, aok := nameIdx[m.Visiteur]
		if !hok || !aok {
			continue
		}
		if *m.ScoreDom > *m.ScoreVis {
			h2hPlayed[hi][ai] += 2
		} else {
			h2hPlayed[ai][hi] += 2
		}
	}

	// Matchs restants
	var pending []pendingMatch
	for _, m := range allMatches {
		if m.Joue {
			continue
		}
		hi, hok := nameIdx[m.Domicile]
		ai, aok := nameIdx[m.Visiteur]
		if !hok || !aok {
			continue
		}
		pending = append(pending, buildPendingMatch(hi, ai, teams[hi], teams[ai]))
	}

	totalScenarios := int64(1) << len(pending) // 2^N

	// Points maximum atteignables par équipe
	maxPts := make([]int, n)
	for i, t := range teams {
		maxPts[i] = t.Pts
	}
	for _, m := range pending {
		maxPts[m.homeIdx] += 2
		maxPts[m.awayIdx] += 2
	}

	// Monte Carlo parallèle
	numWorkers := runtime.NumCPU()
	simsPerWorker := NSimulations / numWorkers
	winCounts := make([]int64, n)
	var mu sync.Mutex
	var wg sync.WaitGroup

	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func(seed int64) {
			defer wg.Done()
			rng := rand.New(rand.NewSource(seed))
			local := make([]int64, n)

			for range simsPerWorker {
				states := baseStates
				var simH2H [12][12]int

				for _, m := range pending {
					if rng.Intn(2) == 0 {
						// Domicile gagne
						s := m.homeWinScores
						states[m.homeIdx].pts += 2
						states[m.homeIdx].bp += s[0]
						states[m.homeIdx].bc += s[1]
						states[m.awayIdx].bp += s[1]
						states[m.awayIdx].bc += s[0]
						simH2H[m.homeIdx][m.awayIdx] += 2
					} else {
						// Visiteur gagne
						s := m.awayWinScores
						states[m.awayIdx].pts += 2
						states[m.awayIdx].bp += s[1]
						states[m.awayIdx].bc += s[0]
						states[m.homeIdx].bp += s[0]
						states[m.homeIdx].bc += s[1]
						simH2H[m.awayIdx][m.homeIdx] += 2
					}
				}

				winner := findChampion(states, h2hPlayed, simH2H, n)
				local[winner]++
			}

			mu.Lock()
			for i := range winCounts {
				winCounts[i] += local[i]
			}
			mu.Unlock()
		}(int64(w*54321 + 1))
	}
	wg.Wait()

	// Construction des résultats
	results := make([]ProjectionResult, n)
	for i, t := range teams {
		winPct := float64(winCounts[i]) / float64(NSimulations)
		estimated := int64(math.Round(winPct * float64(totalScenarios)))
		results[i] = ProjectionResult{
			Team:               t,
			MaxPts:             maxPts[i],
			EstimatedScenarios: estimated,
			TotalScenarios:     totalScenarios,
			WinPct:             winPct * 100,
		}
	}
	return results
}

// findChampion détermine le vainqueur d'une simulation avec les règles de départage :
// 1. Points totaux  2. Confrontation directe  3. Différentiel (BP - BC)
func findChampion(states [12]simTeam, played, sim [12][12]int, n int) int {
	// Maximum de points
	maxPts := 0
	for i := range n {
		if states[i].pts > maxPts {
			maxPts = states[i].pts
		}
	}

	// Équipes à égalité
	var tied [12]int
	tiedN := 0
	for i := range n {
		if states[i].pts == maxPts {
			tied[tiedN] = i
			tiedN++
		}
	}
	if tiedN == 1 {
		return tied[0]
	}

	// Départage 1 : confrontation directe parmi les équipes à égalité
	bestH2H := -1
	var leaders [12]int
	leadN := 0
	for ti := range tiedN {
		i := tied[ti]
		h2hPts := 0
		for tj := range tiedN {
			j := tied[tj]
			if i != j {
				h2hPts += played[i][j] + sim[i][j]
			}
		}
		if h2hPts > bestH2H {
			bestH2H = h2hPts
			leaders[0] = i
			leadN = 1
		} else if h2hPts == bestH2H {
			leaders[leadN] = i
			leadN++
		}
	}
	if leadN == 1 {
		return leaders[0]
	}

	// Départage 2 : différentiel global (BP - BC)
	bestDiff := states[leaders[0]].bp - states[leaders[0]].bc
	champion := leaders[0]
	for li := 1; li < leadN; li++ {
		i := leaders[li]
		diff := states[i].bp - states[i].bc
		if diff > bestDiff {
			bestDiff = diff
			champion = i
		}
	}
	return champion
}
