import {
  fetchStandings,
  fetchCalendrier,
  recentForm,
  remainingDifficulty,
  teamStatus,
} from "@/lib/api";
import StandingsTableClient from "./StandingsTableClient";

type Props = { params: Promise<{ id: string }> };

export default async function StandingsPage({ params }: Props) {
  const { id } = await params;

  let standings;
  try {
    standings = await fetchStandings(id);
  } catch {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p style={{ color: "var(--muted)" }} className="text-sm">
          Impossible de charger le classement. L'API est peut-être en cours de démarrage.
        </p>
        <a href={`/${id}`} className="text-sm underline" style={{ color: "var(--accent)" }}>
          Réessayer
        </a>
      </div>
    );
  }

  const calendrier = await fetchCalendrier(id).catch(() => null);

  const teams = standings.classement;
  const remaining = standings.remaining_matches ?? [];
  const journeesRestantes = (calendrier?.journees ?? []).filter((j) =>
    j.matchs.some((m) => !m.joue)
  );

  const enriched = teams.map((team) => ({
    team,
    form: recentForm(team.equipe, journeesRestantes),
    difficulty: remainingDifficulty(team.equipe, remaining, teams),
    status: teamStatus(team.rang, teams.length),
    remainingCount: remaining.filter(
      (m) =>
        m.domicile === team.equipe.replace(/ - \d+$/, "") ||
        m.visiteur === team.equipe.replace(/ - \d+$/, "")
    ).length,
  }));

  const scrapedAt = standings.scraped_at
    ? new Date(standings.scraped_at).toLocaleDateString("fr-FR")
    : null;

  return (
    <div>
      <StandingsTableClient
        id={id}
        enriched={enriched}
        totalTeams={teams.length}
        remainingMatches={remaining}
        journees={journeesRestantes}
        header={{
          name: standings.name || standings.competition,
          ligue: standings.ligue,
          comite: standings.comite,
          scrapedAt,
        }}
      />
    </div>
  );
}
