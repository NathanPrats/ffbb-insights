import { fetchStandings, fetchCalendrier } from "@/lib/api";
import Link from "next/link";
import SimulateurClient from "./SimulateurClient";

type Props = { params: Promise<{ id: string }> };

export default async function SimulateurPage({ params }: Props) {
  const { id } = await params;

  const [standings, calendrier] = await Promise.all([
    fetchStandings(id),
    fetchCalendrier(id),
  ]);

  // Ne garder que les journées ayant au moins un match non joué
  const journeesRestantes = calendrier.journees.filter((j) =>
    j.matchs.some((m) => !m.joue)
  );

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
      <div className="flex gap-2 mb-8 text-sm">
        <Link
          href={`/${id}`}
          className="px-3 py-1 rounded-full transition-colors"
          style={{ background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}
        >
          Classement
        </Link>
        <span className="px-3 py-1 rounded-full font-medium" style={{ background: "var(--accent)", color: "#fff" }}>
          Simulateur
        </span>
      </div>

      {journeesRestantes.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Tous les matchs ont été joués.
        </p>
      ) : (
        <SimulateurClient
          id={id}
          journees={journeesRestantes}
          teams={standings.classement}
          totalTeams={standings.classement.length}
        />
      )}
    </div>
  );
}
