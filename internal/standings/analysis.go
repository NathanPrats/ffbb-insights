package standings

import (
	"cmp"
	"slices"
)

// TopN retourne les N premières équipes du classement.
func TopN(teams []Team, n int) []Team {
	if n > len(teams) {
		n = len(teams)
	}
	sorted := sortedByRank(teams)
	return sorted[:n]
}

// BestOffense retourne l'équipe avec le plus de points marqués (BP).
func BestOffense(teams []Team) Team {
	return slices.MaxFunc(teams, func(a, b Team) int {
		return cmp.Compare(a.BP, b.BP)
	})
}

// BestDefense retourne l'équipe avec le moins de points encaissés (BC).
func BestDefense(teams []Team) Team {
	return slices.MinFunc(teams, func(a, b Team) int {
		return cmp.Compare(a.BC, b.BC)
	})
}

// BestDiff retourne l'équipe avec le meilleur différentiel (BP - BC).
func BestDiff(teams []Team) Team {
	return slices.MaxFunc(teams, func(a, b Team) int {
		return cmp.Compare(a.Diff(), b.Diff())
	})
}

// sortedByRank retourne une copie des équipes triée par rang croissant.
func sortedByRank(teams []Team) []Team {
	out := make([]Team, len(teams))
	copy(out, teams)
	slices.SortFunc(out, func(a, b Team) int {
		return cmp.Compare(a.Rang, b.Rang)
	})
	return out
}
