import {
  fetchStandings,
  fetchCalendrier,
  recentForm,
  remainingDifficulty,
  teamStatus,
} from "@/lib/api";
import Link from "next/link";
import StandingsTableClient from "./StandingsTableClient";

type Props = { params: Promise<{ id: string }> };

export default async function StandingsPage({ params }: Props) {
  const { id } = await params;

  const [standings, calendrier] = await Promise.all([
    fetchStandings(id),
    fetchCalendrier(id).catch(() => null),
  ]);

  const teams = standings.classement;
  const journees = calendrier?.journees ?? [];
  const remaining = standings.remaining_matches ?? [];

  const enriched = teams.map((team) => ({
    team,
    form: recentForm(team.equipe, journees),
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
        <h1 className="text-2xl font-semibold">{standings.competition}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          {standings.ligue} · Scraped le {standings.scraped_at}
        </p>
      </div>

      {/* Nav */}
      <div className="flex gap-2 mb-6 text-sm">
        <span className="px-3 py-1 rounded-full font-medium" style={{ background: "var(--accent)", color: "#fff" }}>
          Classement
        </span>
        <Link
          href={`/${id}/simulateur`}
          className="px-3 py-1 rounded-full transition-colors"
          style={{ background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}
        >
          Simulateur
        </Link>
      </div>

      <StandingsTableClient
        id={id}
        enriched={enriched}
        totalTeams={teams.length}
        remainingMatches={remaining}
      />
    </div>
  );
}
