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

  const [standings, calendrier] = await Promise.all([
    fetchStandings(id),
    fetchCalendrier(id).catch(() => null),
  ]);

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

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">{standings.name || standings.competition}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          {[standings.ligue, standings.comite].filter(Boolean).join(" · ")} · Scraped le {standings.scraped_at}
        </p>
      </div>

      <StandingsTableClient
        id={id}
        enriched={enriched}
        totalTeams={teams.length}
        remainingMatches={remaining}
        journees={journeesRestantes}
      />
    </div>
  );
}
