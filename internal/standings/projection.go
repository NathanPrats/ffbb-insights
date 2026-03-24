package standings

import (
	"math"
	"math/rand"
	"regexp"
	"runtime"
	"slices"
	"sync"
)

// NSimulations est le nombre de simulations Monte Carlo.
const NSimulations = 200_000

// MaxTeams est la taille maximale des tableaux de simulation.
// Couvre toutes les compétitions FFBB (les poules dépassent rarement 20 équipes).
const MaxTeams = 20

var teamSuffixRe = regexp.MustCompile(` - \d+$`)

// normalizeTeamName supprime le suffixe " - N" présent dans le classement
// mais absent du calendrier (ex. "MB GARGENVILLE - 1" → "MB GARGENVILLE").
func normalizeTeamName(name string) string {
	return teamSuffixRe.ReplaceAllString(name, "")
}

// ProjectionResult contient la projection pour une équipe selon les positions cibles.
type ProjectionResult struct {
	Team               Team
	MaxPts             int
	EstimatedScenarios int64   // estimé par Monte Carlo × 2^N (-1 si 2^N dépasse int64)
	TotalScenarios     int64   // 2^N (-1 si overflow)
	WinPct             float64 // pourcentage de scénarios dans les positions cibles
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
	homeIdx       int
	awayIdx       int
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
// la projection pour chaque équipe selon les positions cibles (1-indexé, ex. [1] ou [1,2] ou [11,12]).
func SimulateChampionship(teams []Team, allMatches []Match, targetPositions []int) []ProjectionResult {
	n := len(teams)

	// Lookup rapide des positions cibles
	var posSet [MaxTeams + 1]bool
	for _, p := range targetPositions {
		if p >= 1 && p <= MaxTeams {
			posSet[p] = true
		}
	}

	// Index nom normalisé → indice équipe
	nameIdx := make(map[string]int, n)
	for i, t := range teams {
		nameIdx[normalizeTeamName(t.Equipe)] = i
	}

	// États de base
	var baseStates [MaxTeams]simTeam
	for i, t := range teams {
		baseStates[i] = simTeam{pts: t.Pts, bp: t.BP, bc: t.BC}
	}

	// H2H des matchs déjà joués : h2hPlayed[i][j] = pts gagnés par i dans ses matchs vs j
	var h2hPlayed [MaxTeams][MaxTeams]int
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

	// 2^N — guard anti-overflow (int64 max ~= 2^63)
	var totalScenarios int64
	if len(pending) < 63 {
		totalScenarios = int64(1) << len(pending)
	} else {
		totalScenarios = -1
	}

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
				var simH2H [MaxTeams][MaxTeams]int

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

				ranks := rankTeams(states, h2hPlayed, simH2H, n)
				for i := range n {
					if posSet[ranks[i]] {
						local[i]++
					}
				}
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
		var estimated int64
		if totalScenarios > 0 {
			estimated = int64(math.Round(winPct * float64(totalScenarios)))
		} else {
			estimated = -1
		}
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

// rankTeams calcule le classement final (1 = premier) pour chaque équipe,
// en appliquant les règles de départage : confrontation directe puis différentiel.
func rankTeams(states [MaxTeams]simTeam, played, sim [MaxTeams][MaxTeams]int, n int) [MaxTeams]int {
	var ranks [MaxTeams]int
	remaining := make([]int, n)
	for i := range n {
		remaining[i] = i
	}

	rankFrom := 1
	for len(remaining) > 0 {
		// Maximum de points parmi les équipes restantes
		maxPts := states[remaining[0]].pts
		for _, i := range remaining[1:] {
			if states[i].pts > maxPts {
				maxPts = states[i].pts
			}
		}

		// Séparer le groupe à égalité du reste
		var tied, rest []int
		for _, i := range remaining {
			if states[i].pts == maxPts {
				tied = append(tied, i)
			} else {
				rest = append(rest, i)
			}
		}

		// Trier le groupe à égalité par les règles de départage
		sortTiedGroup(tied, states, played, sim)
		for j, i := range tied {
			ranks[i] = rankFrom + j
		}
		rankFrom += len(tied)
		remaining = rest
	}
	return ranks
}

// sortTiedGroup trie en place un groupe d'équipes à égalité de points :
// 1. Confrontation directe parmi le groupe (desc)  2. Différentiel global BP-BC (desc)
func sortTiedGroup(group []int, states [MaxTeams]simTeam, played, sim [MaxTeams][MaxTeams]int) {
	if len(group) <= 1 {
		return
	}
	// Pré-calculer les points H2H de chaque équipe dans le groupe (indexé par team index)
	var h2h [MaxTeams]int
	for _, i := range group {
		for _, j := range group {
			if i != j {
				h2h[i] += played[i][j] + sim[i][j]
			}
		}
	}
	slices.SortStableFunc(group, func(a, b int) int {
		if h2h[a] != h2h[b] {
			return h2h[b] - h2h[a] // plus de pts H2H = mieux classé
		}
		return (states[b].bp - states[b].bc) - (states[a].bp - states[a].bc)
	})
}
