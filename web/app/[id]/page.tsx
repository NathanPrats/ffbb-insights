import {
  fetchStandings,
  fetchCalendrier,
  recentForm,
  remainingDifficulty,
  teamStatus,
  type Team,
  type Journee,
  type Match,
} from "@/lib/api";
import Link from "next/link";

type Props = { params: Promise<{ id: string }> };

export default async function StandingsPage({ params }: Props) {
  const { id } = await params;

  const [standings, calendrier] = await Promise.all([
    fetchStandings(id),
    fetchCalendrier(id).catch(() => null),
  ]);

  const teams = standings.classement;
  const journees: Journee[] = calendrier?.journees ?? [];
  const remaining: Match[] = standings.remaining_matches ?? [];

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
          href={`/${id}/projections`}
          className="px-3 py-1 rounded-full transition-colors"
          style={{ background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}
        >
          Projections
        </Link>
        <Link
          href={`/${id}/simulateur`}
          className="px-3 py-1 rounded-full transition-colors"
          style={{ background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}
        >
          Simulateur
        </Link>
      </div>

      {/* Legend */}
      <div className="flex gap-5 text-xs mb-4" style={{ color: "var(--muted)" }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Montée
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" /> Incertain
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" /> Danger
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs" style={{ background: "var(--card)", color: "var(--muted)", borderBottom: "1px solid var(--border)" }}>
              <th className="py-3 px-4 text-left font-medium w-8">#</th>
              <th className="py-3 px-4 text-left font-medium">Équipe</th>
              <th className="py-3 px-3 text-center font-medium font-mono">Pts</th>
              <th className="py-3 px-3 text-center font-medium font-mono">V</th>
              <th className="py-3 px-3 text-center font-medium font-mono">D</th>
              <th className="py-3 px-3 text-center font-medium font-mono">+/-</th>
              <th className="py-3 px-4 text-center font-medium">Forme</th>
              <th className="py-3 px-4 text-center font-medium">Calendrier</th>
            </tr>
          </thead>
          <tbody>
            {enriched.map(({ team, form, difficulty, status, remainingCount }, i) => (
              <tr
                key={team.equipe}
                style={{
                  borderBottom: i < teams.length - 1 ? "1px solid var(--border)" : undefined,
                  background:
                    status === "safe"
                      ? "rgba(22,163,74,0.06)"
                      : status === "danger"
                      ? "rgba(220,38,38,0.06)"
                      : undefined,
                }}
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <StatusDot status={status} />
                    <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                      {team.rang}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4 font-medium">{team.equipe}</td>
                <td className="py-3 px-3 text-center font-mono font-semibold">{team.pts}</td>
                <td className="py-3 px-3 text-center font-mono text-green-600">{team.gagnes}</td>
                <td className="py-3 px-3 text-center font-mono text-red-500">{team.perdus}</td>
                <td
                  className="py-3 px-3 text-center font-mono text-xs"
                  style={{ color: team.bp - team.bc >= 0 ? "rgb(22,163,74)" : "rgb(220,38,38)" }}
                >
                  {team.bp - team.bc > 0 ? "+" : ""}
                  {team.bp - team.bc}
                </td>
                <td className="py-3 px-4">
                  <FormDots form={form} />
                </td>
                <td className="py-3 px-4 text-center">
                  <DifficultyBadge difficulty={difficulty} remaining={remainingCount} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs mt-4" style={{ color: "var(--muted)" }}>
        Forme : 5 derniers matchs · Calendrier : difficulté des adversaires restants
      </p>
    </div>
  );
}

function StatusDot({ status }: { status: "safe" | "uncertain" | "danger" }) {
  const color =
    status === "safe" ? "bg-green-500" : status === "danger" ? "bg-red-500" : "bg-amber-400";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />;
}

function FormDots({ form }: { form: ("W" | "L")[] }) {
  if (form.length === 0)
    return <span className="text-xs" style={{ color: "var(--muted)" }}>—</span>;
  return (
    <div className="flex gap-1 justify-center">
      {form.map((r, i) => (
        <span
          key={i}
          title={r === "W" ? "Victoire" : "Défaite"}
          className={`inline-block w-4 h-4 rounded-sm text-[9px] font-bold flex items-center justify-center ${
            r === "W" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
          }`}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

function DifficultyBadge({ difficulty, remaining }: { difficulty: number; remaining: number }) {
  if (remaining === 0)
    return <span className="text-xs" style={{ color: "var(--muted)" }}>terminé</span>;

  const label = difficulty > 0.6 ? "difficile" : difficulty > 0.4 ? "moyen" : "facile";
  const color =
    difficulty > 0.6
      ? "text-red-500"
      : difficulty > 0.4
      ? "text-amber-500"
      : "text-green-600";

  return (
    <span className={`text-xs font-mono ${color}`}>
      {label} <span style={{ color: "var(--muted)" }}>({remaining})</span>
    </span>
  );
}
