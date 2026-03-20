// Package scraper récupère les données FFBB directement depuis competitions.ffbb.com.
// Aucun fichier n'est écrit sur le disque : tout est retourné en mémoire.
// Port du scraper Python (scraper_classement.py, scraper_calendrier.py, ffbb_rsc.py).
package scraper

import (
	gohtml "html"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"ffbb-insights/internal/standings"
)

// ── HTTP ──────────────────────────────────────────────────────────────────────

var httpClient = &http.Client{Timeout: 15 * time.Second}

func fetchHTML(rawURL string) (string, error) {
	req, err := http.NewRequest("GET", rawURL, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "fr-FR,fr;q=0.9,en;q=0.8")

	resp, err := httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("GET %s: %w", rawURL, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("GET %s: status %d", rawURL, resp.StatusCode)
	}

	var sb strings.Builder
	buf := make([]byte, 32*1024)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			sb.Write(buf[:n])
		}
		if err != nil {
			break
		}
	}
	return sb.String(), nil
}

// ── URL parsing ───────────────────────────────────────────────────────────────

// CompetitionMeta contient les métadonnées d'une compétition extraites de son URL.
type CompetitionMeta struct {
	Phase         string
	Poule         string
	Ligue         string
	Comite        string
	Competition   string
	Slug          string
	ClassementURL string
	CalendrierURL string
}

// ParseFFBBURL analyse une URL FFBB et retourne ses métadonnées.
// Exemple : https://competitions.ffbb.com/ligues/idf/comites/0078/competitions/dm3/classement?phase=X&poule=Y
func ParseFFBBURL(rawURL string) (CompetitionMeta, error) {
	u, err := url.Parse(rawURL)
	if err != nil {
		return CompetitionMeta{}, fmt.Errorf("parse url: %w", err)
	}

	q := u.Query()
	phase := q.Get("phase")
	poule := q.Get("poule")
	if phase == "" || poule == "" {
		return CompetitionMeta{}, fmt.Errorf("paramètres phase/poule manquants dans l'URL: %s", rawURL)
	}

	segments := []string{}
	for _, s := range strings.Split(u.Path, "/") {
		if s != "" {
			segments = append(segments, s)
		}
	}

	segmentAfter := func(key string) string {
		for i, s := range segments {
			if s == key && i+1 < len(segments) {
				return segments[i+1]
			}
		}
		return ""
	}

	ligue := segmentAfter("ligues")
	comite := segmentAfter("comites")
	competition := segmentAfter("competitions")

	// URL de base sans /classement
	basePath := strings.TrimSuffix(u.Path, "/classement")

	// URL classement canonique
	classementURL := fmt.Sprintf("%s://%s%s/classement?phase=%s&poule=%s",
		u.Scheme, u.Host, basePath, phase, poule)

	// URL calendrier : page racine sans filtre de journée pour avoir toute la saison
	calURL := fmt.Sprintf("%s://%s%s?phase=%s&poule=%s",
		u.Scheme, u.Host, basePath, phase, poule)

	slug := strings.ToLower(ligue + "-" + competition)

	return CompetitionMeta{
		Phase:         phase,
		Poule:         poule,
		Ligue:         ligue,
		Comite:        comite,
		Competition:   competition,
		Slug:          slug,
		ClassementURL: classementURL,
		CalendrierURL: calURL,
	}, nil
}

// ── RSC chunk extraction ──────────────────────────────────────────────────────

var rscRe = regexp.MustCompile(`(?s)<script[^>]*>self\.__next_f\.push\(\[(.*?)\]\)</script>`)

// extractRSCChunks extrait les payloads texte depuis les balises RSC Next.js
// (self.__next_f.push([index, "payload"])).
func extractRSCChunks(htmlContent string) []string {
	var chunks []string
	for _, match := range rscRe.FindAllStringSubmatch(htmlContent, -1) {
		raw := "[" + match[1] + "]"
		var parsed []interface{}
		if err := json.Unmarshal([]byte(raw), &parsed); err != nil {
			continue
		}
		if len(parsed) >= 2 {
			if s, ok := parsed[1].(string); ok {
				chunks = append(chunks, s)
			}
		}
	}
	return chunks
}

// ── Standings parsing ─────────────────────────────────────────────────────────

var (
	rowRe      = regexp.MustCompile(`(?s)<tr class="h-\[65px\] bg-white"[^>]*data-onboarding[^>]*>(.*?)</tr>`)
	tdRe       = regexp.MustCompile(`(?s)<td[^>]*>(.*?)</td>`)
	spanNumRe  = regexp.MustCompile(`<span[^>]*>(\d+)</span>`)
	teamNameRe = regexp.MustCompile(`<div class="min-w-\[228px\][^"]*">([^<]+)</div>`)
	divNumRe   = regexp.MustCompile(`<div[^>]*>(\d+)</div>`)
	titleRe    = regexp.MustCompile(`<title>([^<]+)</title>`)
)

// extractCompetitionName tente d'extraire le nom lisible de la compétition
// depuis le <title> de la page (ex: "Départemental Masculin 3 | Île-de-France | FFBB").
func extractCompetitionName(htmlContent string) string {
	m := titleRe.FindStringSubmatch(htmlContent)
	if m == nil {
		return ""
	}
	// Le titre FFBB est typiquement "Nom compétition | Ligue | FFBB"
	// On garde uniquement la première partie.
	parts := strings.SplitN(m[1], "|", 2)
	name := strings.TrimSpace(gohtml.UnescapeString(parts[0]))
	return name
}

func extractStandingsFromHTML(htmlContent string) ([]standings.Team, error) {
	var teams []standings.Team

	for _, rowMatch := range rowRe.FindAllStringSubmatch(htmlContent, -1) {
		rowBody := rowMatch[1]
		tdMatches := tdRe.FindAllStringSubmatch(rowBody, -1)
		if len(tdMatches) < 11 {
			continue
		}
		tds := make([]string, len(tdMatches))
		for i, m := range tdMatches {
			tds[i] = m[1]
		}

		// td[0] : rang
		rangMatch := spanNumRe.FindStringSubmatch(tds[0])
		if rangMatch == nil {
			continue
		}
		rang, _ := strconv.Atoi(rangMatch[1])

		// td[1] : équipe
		equipeMatch := teamNameRe.FindStringSubmatch(tds[1])
		if equipeMatch == nil {
			continue
		}
		equipe := gohtml.UnescapeString(strings.TrimSpace(equipeMatch[1]))

		// td[2] : pts (texte brut sans balises)
		ptsText := strings.TrimSpace(stripTags(tds[2]))
		if ptsText == "" {
			continue
		}
		pts, err := strconv.Atoi(ptsText)
		if err != nil {
			continue
		}

		// td[3] : joues/gagnes/perdus/nuls (4 <div> imbriqués)
		wl := getDivNumbers(tds[3])
		if len(wl) < 4 {
			continue
		}

		// td[10] : bp/bc/diff
		bpbc := getDivNumbers(tds[10])
		if len(bpbc) < 2 {
			continue
		}

		teams = append(teams, standings.Team{
			Rang:      rang,
			Equipe:    equipe,
			Pts:       pts,
			Joues:     wl[0],
			Gagnes:    wl[1],
			Perdus:    wl[2],
			Nuls:      wl[3],
			BP:        bpbc[0],
			BC:        bpbc[1],
			Penalites: 0,
		})
	}

	if len(teams) == 0 {
		return nil, fmt.Errorf("aucune équipe trouvée dans le HTML (structure FFBB changée ?)")
	}
	return teams, nil
}

func getDivNumbers(s string) []int {
	var nums []int
	for _, m := range divNumRe.FindAllStringSubmatch(s, -1) {
		n, _ := strconv.Atoi(m[1])
		nums = append(nums, n)
	}
	return nums
}

var tagRe = regexp.MustCompile(`<[^>]+>`)

func stripTags(s string) string {
	return tagRe.ReplaceAllString(s, "")
}

// ── Calendar parsing ──────────────────────────────────────────────────────────

var suffixRe = regexp.MustCompile(` - \d+$`)

func normalizeName(name string) string {
	return suffixRe.ReplaceAllString(name, "")
}

// rencontreRaw est le format brut d'une rencontre dans le payload RSC FFBB.
type rencontreRaw struct {
	DateRencontre  string `json:"date_rencontre"`
	Equipe1        struct {
		Nom string `json:"nom"`
	} `json:"idEngagementEquipe1"`
	Equipe2        struct {
		Nom string `json:"nom"`
	} `json:"idEngagementEquipe2"`
	ResultatEquipe1 string `json:"resultatEquipe1"`
	ResultatEquipe2 string `json:"resultatEquipe2"`
	Joue            bool   `json:"joue"`
}

// extractRencontresFromChunks cherche toutes les occurrences de "rencontres": dans les chunks RSC.
func extractRencontresFromChunks(chunks []string) [][]rencontreRaw {
	var all [][]rencontreRaw
	for _, chunk := range chunks {
		start := 0
		for {
			idx := strings.Index(chunk[start:], `"rencontres":`)
			if idx == -1 {
				break
			}
			abs := start + idx
			bracket := strings.Index(chunk[abs:], "[")
			if bracket == -1 {
				break
			}
			bracketAbs := abs + bracket
			arr, err := extractJSONArrayAt(chunk, bracketAbs)
			if err == nil && len(arr) > 0 {
				all = append(all, arr)
			}
			start = bracketAbs + 1
		}
	}
	return all
}

// extractJSONArrayAt extrait un tableau JSON depuis la position bracket dans chunk
// en comptant la profondeur des crochets.
func extractJSONArrayAt(chunk string, bracket int) ([]rencontreRaw, error) {
	depth := 0
	for i := bracket; i < len(chunk); i++ {
		switch chunk[i] {
		case '[':
			depth++
		case ']':
			depth--
			if depth == 0 {
				var arr []rencontreRaw
				if err := json.Unmarshal([]byte(chunk[bracket:i+1]), &arr); err != nil {
					return nil, err
				}
				return arr, nil
			}
		}
	}
	return nil, fmt.Errorf("crochet non fermé")
}

func normalizeRencontre(r rencontreRaw) (standings.Match, error) {
	t, err := time.Parse("2006-01-02T15:04:05", r.DateRencontre)
	if err != nil {
		// Essayer avec fuseau horaire
		t, err = time.Parse(time.RFC3339, r.DateRencontre)
		if err != nil {
			return standings.Match{}, fmt.Errorf("parse date %q: %w", r.DateRencontre, err)
		}
	}

	m := standings.Match{
		Heure:    t.Format("15:04"),
		Domicile: r.Equipe1.Nom,
		Visiteur: r.Equipe2.Nom,
		Joue:     r.Joue,
	}

	if r.ResultatEquipe1 != "" {
		if v, err := strconv.Atoi(r.ResultatEquipe1); err == nil {
			m.ScoreDom = &v
		}
	}
	if r.ResultatEquipe2 != "" {
		if v, err := strconv.Atoi(r.ResultatEquipe2); err == nil {
			m.ScoreVis = &v
		}
	}
	return m, nil
}

func groupByDate(rencontres []rencontreRaw) []standings.Journee {
	byDate := make(map[string][]standings.Match)
	for _, r := range rencontres {
		t, err := time.Parse("2006-01-02T15:04:05", r.DateRencontre)
		if err != nil {
			t2, err2 := time.Parse(time.RFC3339, r.DateRencontre)
			if err2 != nil {
				continue
			}
			t = t2
		}
		jour := t.Format("2006-01-02")
		m, err := normalizeRencontre(r)
		if err != nil {
			continue
		}
		byDate[jour] = append(byDate[jour], m)
	}

	dates := make([]string, 0, len(byDate))
	for d := range byDate {
		dates = append(dates, d)
	}
	sort.Strings(dates)

	journees := make([]standings.Journee, 0, len(dates))
	for _, d := range dates {
		journees = append(journees, standings.Journee{
			Date:   d,
			Matchs: byDate[d],
		})
	}
	return journees
}

// ── Public API ────────────────────────────────────────────────────────────────

// FetchStandings scrape le classement FFBB depuis l'URL donnée.
func FetchStandings(classementURL string) (*standings.Classement, error) {
	meta, err := ParseFFBBURL(classementURL)
	if err != nil {
		return nil, err
	}

	htmlContent, err := fetchHTML(classementURL)
	if err != nil {
		return nil, fmt.Errorf("fetch classement: %w", err)
	}

	teams, err := extractStandingsFromHTML(htmlContent)
	if err != nil {
		return nil, fmt.Errorf("parse classement: %w", err)
	}

	return &standings.Classement{
		Name:        extractCompetitionName(htmlContent),
		Competition: meta.Competition,
		Ligue:       meta.Ligue,
		Comite:      meta.Comite,
		Phase:       meta.Phase,
		Poule:       meta.Poule,
		SourceURL:   classementURL,
		ScrapedAt:   time.Now().Format("2006-01-02"),
		Teams:       teams,
	}, nil
}

// FetchCalendrier scrape le calendrier FFBB depuis l'URL classement donnée.
// teamFilter (noms normalisés sans suffixe) permet de filtrer les rencontres
// sur les compétitions multi-poules.
func FetchCalendrier(classementURL string, teamFilter map[string]bool) (*standings.Calendrier, error) {
	meta, err := ParseFFBBURL(classementURL)
	if err != nil {
		return nil, err
	}

	htmlContent, err := fetchHTML(meta.CalendrierURL)
	if err != nil {
		return nil, fmt.Errorf("fetch calendrier: %w", err)
	}

	chunks := extractRSCChunks(htmlContent)
	allArrays := extractRencontresFromChunks(chunks)
	if len(allArrays) == 0 {
		return nil, fmt.Errorf("aucune rencontre trouvée dans le payload RSC (structure FFBB changée ?)")
	}

	// Dédupliquer les rencontres par clé (dom, vis, date) pour éviter les doublons
	// entre journées présentes plusieurs fois dans le payload RSC.
	type matchKey struct{ dom, vis, date string }
	seen := make(map[matchKey]bool)
	var selected []rencontreRaw

	for _, arr := range allArrays {
		for _, r := range arr {
			dom := normalizeName(r.Equipe1.Nom)
			vis := normalizeName(r.Equipe2.Nom)
			if len(teamFilter) > 0 && (!teamFilter[dom] || !teamFilter[vis]) {
				continue
			}
			k := matchKey{dom, vis, r.DateRencontre}
			if seen[k] {
				continue
			}
			seen[k] = true
			selected = append(selected, r)
		}
	}

	if len(selected) == 0 {
		return nil, fmt.Errorf("aucune rencontre ne correspond aux équipes du classement")
	}

	return &standings.Calendrier{
		Phase:     meta.Phase,
		Poule:     meta.Poule,
		ScrapedAt: time.Now().Format("2006-01-02"),
		Journees:  groupByDate(selected),
	}, nil
}
