import { fetchCompetitions } from "@/lib/api";
import Link from "next/link";

export default async function HomePage() {
  let competitions = await fetchCompetitions().catch(() => null);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Championnats</h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>
        Sélectionne un championnat pour voir le classement et les projections.
      </p>

      {!competitions ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Impossible de joindre l&apos;API. Lance <code className="font-mono">make dev</code> d&apos;abord.
        </p>
      ) : competitions.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Aucune compétition trouvée dans <code className="font-mono">data/</code>.
        </p>
      ) : (
        <div className="grid gap-3">
          {competitions.map((c) => (
            <Link
              key={c.id}
              href={`/${c.id}`}
              className="block rounded-lg px-5 py-4 transition-colors"
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <span className="font-medium">{c.competition}</span>
                  <span className="text-sm ml-3" style={{ color: "var(--muted)" }}>
                    {c.ligue}
                  </span>
                </div>
                <span className="text-xs font-mono shrink-0" style={{ color: "var(--muted)" }}>
                  {c.scraped_at}
                </span>
              </div>
              <div className="text-xs mt-1 font-mono" style={{ color: "var(--muted)" }}>
                {c.id}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
