const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

// ---- Types ----

export type Team = {
  rang: number;
  equipe: string;
  pts: number;
  joues: number;
  gagnes: number;
  perdus: number;
  nuls: number;
  bp: number;
  bc: number;
  penalites: number;
};

export type Match = {
  heure: string;
  domicile: string;
  visiteur: string;
  score_dom: number | null;
  score_vis: number | null;
  joue: boolean;
};

export type Journee = {
  date: string;
  matchs: Match[];
};

export type Classement = {
  competition: string;
  ligue: string;
  comite: string;
  phase: string;
  poule: string;
  source_url: string;
  scraped_at: string;
  classement: Team[];
  remaining_matches: Match[];
};

export type Calendrier = {
  phase: string;
  poule: string;
  scraped_at: string;
  journees: Journee[];
};

export type Competition = {
  id: string;
  competition: string;
  ligue: string;
};

export type ProjectionResult = {
  Team: Team;
  MaxPts: number;
  EstimatedScenarios: number;
  TotalScenarios: number;
  WinPct: number;
};

// ---- Fetch helpers ----

export async function fetchCompetitions(): Promise<Competition[]> {
  const res = await fetch(`${API_BASE}/api/competitions`, { cache: "no-store" });
  if (!res.ok) throw new Error("Impossible de charger les compétitions");
  return res.json();
}

export async function fetchStandings(id: string): Promise<Classement> {
  const res = await fetch(`${API_BASE}/api/competitions/${id}/standings`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Classement introuvable : ${id}`);
  return res.json();
}

export async function fetchCalendrier(id: string): Promise<Calendrier> {
  const res = await fetch(`${API_BASE}/api/competitions/${id}/calendar`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Calendrier introuvable : ${id}`);
  return res.json();
}

export async function fetchProjections(
  id: string,
  top = 1,
  bottom = 0
): Promise<ProjectionResult[]> {
  const params = bottom > 0 ? `bottom=${bottom}` : `top=${top}`;
  const res = await fetch(`${API_BASE}/api/competitions/${id}/projections?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Erreur lors du calcul des projections");
  return res.json();
}

// ---- Enrichment helpers ----

/** Derniers N résultats d'une équipe (W ou L), du plus récent au plus ancien. */
export function recentForm(teamName: string, journees: Journee[], n = 5): ("W" | "L")[] {
  const normalized = teamName.replace(/ - \d+$/, "");
  const played: ("W" | "L")[] = [];

  for (let i = journees.length - 1; i >= 0 && played.length < n; i--) {
    for (const m of [...journees[i].matchs].reverse()) {
      if (!m.joue || m.score_dom === null || m.score_vis === null) continue;

      const isDom = m.domicile === normalized;
      const isVis = m.visiteur === normalized;
      if (!isDom && !isVis) continue;

      const won = isDom ? m.score_dom > m.score_vis : m.score_vis > m.score_dom;
      played.push(won ? "W" : "L");
      if (played.length >= n) break;
    }
  }

  return played.reverse();
}

/** Difficulté du calendrier restant : win rate moyen des adversaires (0→1). */
export function remainingDifficulty(
  teamName: string,
  remainingMatches: Match[],
  teams: Team[]
): number {
  const normalized = teamName.replace(/ - \d+$/, "");
  const winRates = new Map(
    teams.map((t) => [t.equipe.replace(/ - \d+$/, ""), t.joues > 0 ? t.gagnes / t.joues : 0.5])
  );

  const opponents = remainingMatches
    .filter((m) => m.domicile === normalized || m.visiteur === normalized)
    .map((m) => (m.domicile === normalized ? m.visiteur : m.domicile));

  if (opponents.length === 0) return 0;
  const avg = opponents.reduce((sum, opp) => sum + (winRates.get(opp) ?? 0.5), 0) / opponents.length;
  return avg;
}

/** Statut d'une équipe selon sa position. */
export function teamStatus(rang: number, total: number): "safe" | "uncertain" | "danger" {
  const promotionZone = 2;
  const relegationZone = 2;
  if (rang <= promotionZone) return "safe";
  if (rang > total - relegationZone) return "danger";
  return "uncertain";
}
