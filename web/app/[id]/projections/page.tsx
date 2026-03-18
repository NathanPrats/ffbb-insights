import { fetchStandings } from "@/lib/api";
import Link from "next/link";
import ProjectionsClient from "./ProjectionsClient";

type Props = { params: Promise<{ id: string }> };

export default async function ProjectionsPage({ params }: Props) {
  const { id } = await params;
  const standings = await fetchStandings(id);

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
          Projections
        </span>
        <Link
          href={`/${id}/simulateur`}
          className="px-3 py-1 rounded-full transition-colors"
          style={{ background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}
        >
          Simulateur
        </Link>
      </div>

      <ProjectionsClient
        id={id}
        totalTeams={standings.classement.length}
        remainingMatches={standings.remaining_matches ?? []}
      />
    </div>
  );
}
