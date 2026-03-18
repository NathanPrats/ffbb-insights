"use client";

import { useEffect, useState } from "react";
import type { ProjectionResult, Match } from "@/lib/api";
import { BasketballLoader } from "@/components/BasketballLoader";

type Target = "top" | "bottom";

type Props = {
  id: string;
  totalTeams: number;
  remainingMatches: Match[];
};

export default function ProjectionsClient({ id, totalTeams, remainingMatches }: Props) {
  const [target, setTarget] = useState<Target>("top");
  const [n, setN] = useState(2);
  const [results, setResults] = useState<ProjectionResult[] | null>(null);
  const [loading, setLoading] = useState(true);

  const maxN = Math.min(4, Math.floor(totalTeams / 2));

  useEffect(() => {
    setLoading(true);
    const params = target === "top" ? `top=${n}` : `bottom=${n}`;
    fetch(`/api/competitions/${id}/projections?${params}`)
      .then((r) => r.json())
      .then((data: ProjectionResult[]) => {
        const sorted = [...data].sort((a, b) => b.WinPct - a.WinPct);
        setResults(sorted);
      })
      .finally(() => setLoading(false));
  }, [id, target, n]);

  const label = target === "top" ? "montée" : "maintien";
  const inZone = results?.filter((r) => r.WinPct > 0) ?? [];
  const eliminated = results?.filter((r) => r.WinPct === 0) ?? [];

  function maitreDeSonDestin(result: ProjectionResult): boolean {
    if (target !== "top" || !results) return false;
    if (result.WinPct === 0 || result.WinPct >= 99.9) return false;

    const norm = (name: string) => name.replace(/ - \d+$/, "").toLowerCase().trim();
    const teamName = norm(result.Team.equipe);

    // Points perdus par chaque adversaire si T gagne tous ses matchs directs
    const ptsLostByOpponent = new Map<string, number>();
    for (const m of remainingMatches) {
      const dom = norm(m.domicile);
      const vis = norm(m.visiteur);
      if (dom === teamName) {
        ptsLostByOpponent.set(vis, (ptsLostByOpponent.get(vis) ?? 0) + 2);
      } else if (vis === teamName) {
        ptsLostByOpponent.set(dom, (ptsLostByOpponent.get(dom) ?? 0) + 2);
      }
    }

    // Combien d'équipes peuvent encore finir avec plus de points que T.MaxPts ?
    const teamsAbove = results.filter((r) => {
      if (norm(r.Team.equipe) === teamName) return false;
      const effectiveMax = r.MaxPts - (ptsLostByOpponent.get(norm(r.Team.equipe)) ?? 0);
      return effectiveMax > result.MaxPts;
    }).length;

    return teamsAbove < n;
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-8">
        {/* Target toggle */}
        <div
          className="flex rounded-lg p-1 gap-1"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          {(["top", "bottom"] as Target[]).map((t) => (
            <button
              key={t}
              onClick={() => setTarget(t)}
              className="px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
              style={
                target === t
                  ? { background: "var(--accent)", color: "#fff" }
                  : { color: "var(--muted)" }
              }
            >
              {t === "top" ? "Montée" : "Relégation"}
            </button>
          ))}
        </div>

        {/* N selector */}
        <div className="flex items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
          <span>Places :</span>
          <div
            className="flex rounded-lg p-1 gap-1"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            {Array.from({ length: maxN }, (_, i) => i + 1).map((v) => (
              <button
                key={v}
                onClick={() => setN(v)}
                className="w-8 h-7 rounded text-sm font-mono font-medium transition-colors"
                style={
                  n === v
                    ? { background: "var(--accent)", color: "#fff" }
                    : { color: "var(--muted)" }
                }
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <BasketballLoader label="Calcul en cours…" />
      ) : results === null ? (
        <div className="text-sm py-16 text-center" style={{ color: "var(--muted)" }}>
          Erreur lors du chargement.
        </div>
      ) : (
        <div>
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {inZone.map((r, i) => (
              <ResultRow
                key={r.Team.equipe}
                result={r}
                target={target}
                isLast={i === inZone.length - 1 && eliminated.length === 0}
                showDivider={i < inZone.length - 1 || eliminated.length > 0}
                maitre={maitreDeSonDestin(r)}
                derniereChance={r.TotalScenarios > 0 && r.EstimatedScenarios === 1}
              />
            ))}

            {eliminated.length > 0 && (
              <>
                <div
                  className="px-5 py-2 text-xs font-medium"
                  style={{ background: "var(--card)", color: "var(--muted)", borderTop: "1px solid var(--border)" }}
                >
                  {target === "top" ? "Éliminés mathématiquement" : "Maintenus mathématiquement"}
                </div>
                {eliminated.map((r, i) => (
                  <ResultRow
                    key={r.Team.equipe}
                    result={r}
                    target={target}
                    isLast={i === eliminated.length - 1}
                    showDivider={i < eliminated.length - 1}
                    dimmed
                  />
                ))}
              </>
            )}
          </div>

          <p className="text-xs mt-4" style={{ color: "var(--muted)" }}>
            10 000 000 simulations · Départage : confrontation directe puis différentiel
          </p>
        </div>
      )}
    </div>
  );
}

function ResultRow({
  result,
  target,
  showDivider,
  dimmed = false,
  maitre = false,
  derniereChance = false,
}: {
  result: ProjectionResult;
  target: Target;
  isLast: boolean;
  showDivider: boolean;
  dimmed?: boolean;
  maitre?: boolean;
  derniereChance?: boolean;
}) {
  const pct = result.WinPct;
  const maxPts = result.MaxPts;
  const currentPts = result.Team.pts;

  const barColor =
    pct >= 60
      ? "rgb(34,197,94)"
      : pct >= 25
      ? "rgb(234,179,8)"
      : pct > 0
      ? "rgb(249,115,22)"
      : "rgb(75,85,99)";

  const scenarioStr =
    result.TotalScenarios < 0
      ? null
      : `${formatCount(result.EstimatedScenarios)} / ${formatCount(result.TotalScenarios)} scénarios`;

  return (
    <div
      style={{
        borderBottom: showDivider ? "1px solid var(--border)" : undefined,
        opacity: dimmed ? 0.45 : 1,
      }}
    >
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Rang + nom */}
        <div className="w-6 text-center font-mono text-xs" style={{ color: "var(--muted)" }}>
          {result.Team.rang}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{result.Team.equipe}</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
            {currentPts} pts actuels · max {maxPts} pts
            {scenarioStr && (
              <span className="ml-2 font-mono">{scenarioStr}</span>
            )}
          </div>
        </div>

        {/* Tags + % */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {maitre && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: "rgba(61,95,160,0.1)", color: "var(--accent)" }}
            >
              Maître de leur destin
            </span>
          )}
          {derniereChance && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: "rgba(220,38,38,0.08)", color: "rgb(220,38,38)" }}
            >
              Dernière chance
            </span>
          )}
          <div className="w-16 text-right">
            {pct === 0 ? (
              <span className="text-sm" style={{ color: "var(--muted)" }}>
                {target === "top" ? "éliminé" : "maintenu ✓"}
              </span>
            ) : pct >= 99.9 ? (
              <span className="text-sm font-semibold text-green-600">
                {target === "top" ? "assuré ✓" : "relégué"}
              </span>
            ) : (
              <span className="text-xl font-semibold font-mono" style={{ color: barColor }}>
                {pct.toFixed(1)}
                <span className="text-sm font-normal" style={{ color: "var(--muted)" }}>%</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {pct > 0 && pct < 99.9 && (
        <div className="px-5 pb-3">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: barColor }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function formatCount(n: number): string {
  if (n < 0) return "?";
  return n.toLocaleString("fr-FR");
}
