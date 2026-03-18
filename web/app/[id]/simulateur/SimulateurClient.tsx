"use client";

import { useEffect, useRef, useState } from "react";
import type { Journee, ProjectionResult, Team } from "@/lib/api";

type Target = "top" | "bottom";
type Winner = "domicile" | "visiteur";
type Overrides = Record<string, Winner>;

type Props = {
  id: string;
  journees: Journee[];
  teams: Team[];
  totalTeams: number;
};

export default function SimulateurClient({ id, journees, teams, totalTeams }: Props) {
  const [overrides, setOverrides] = useState<Overrides>({});
  const [target, setTarget] = useState<Target>("top");
  const [n, setN] = useState(2);
  const [results, setResults] = useState<ProjectionResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const maxN = Math.min(4, Math.floor(totalTeams / 2));

  // Recalcul avec debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      const targetPositions =
        target === "top"
          ? Array.from({ length: n }, (_, i) => i + 1)
          : Array.from({ length: n }, (_, i) => totalTeams - n + 1 + i);

      const overridesList = Object.entries(overrides).map(([key, winner]) => {
        const [domicile, visiteur] = key.split("__");
        return { domicile, visiteur, winner };
      });

      fetch(`/api/competitions/${id}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: overridesList, target_positions: targetPositions }),
      })
        .then((r) => r.json())
        .then((data: ProjectionResult[]) =>
          setResults([...data].sort((a, b) => b.WinPct - a.WinPct))
        )
        .finally(() => setLoading(false));
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [id, overrides, target, n, totalTeams]);

  function toggle(domicile: string, visiteur: string, winner: Winner) {
    const key = `${domicile}__${visiteur}`;
    setOverrides((prev) => {
      if (prev[key] === winner) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: winner };
    });
  }

  const forcedCount = Object.keys(overrides).length;

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
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

        {forcedCount > 0 && (
          <button
            onClick={() => setOverrides({})}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
          >
            Réinitialiser ({forcedCount})
          </button>
        )}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Matches */}
        <div className="space-y-5">
          {journees.map((j) => {
            const remaining = j.matchs.filter((m) => !m.joue);
            if (remaining.length === 0) return null;
            return (
              <div key={j.date}>
                <div className="text-xs font-mono mb-2" style={{ color: "var(--muted)" }}>
                  {formatDate(j.date)}
                </div>
                <div
                  className="rounded-lg overflow-hidden"
                  style={{ border: "1px solid var(--border)" }}
                >
                  {remaining.map((m, i) => {
                    const key = `${m.domicile}__${m.visiteur}`;
                    const current = overrides[key];
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-3 px-4 py-3"
                        style={{
                          borderBottom:
                            i < remaining.length - 1 ? "1px solid var(--border)" : undefined,
                          background: current ? "rgba(249,115,22,0.04)" : undefined,
                        }}
                      >
                        {/* Domicile */}
                        <span
                          className="flex-1 text-sm text-right truncate"
                          style={{
                            color: current === "domicile" ? "var(--foreground)" : "var(--muted)",
                            fontWeight: current === "domicile" ? 600 : 400,
                          }}
                        >
                          {m.domicile}
                        </span>

                        {/* Toggles */}
                        <div className="flex items-center gap-1 shrink-0">
                          <ToggleBtn
                            label="DOM"
                            active={current === "domicile"}
                            onClick={() => toggle(m.domicile, m.visiteur, "domicile")}
                          />
                          <span className="text-xs w-4 text-center" style={{ color: "var(--muted)" }}>
                            {current ? "·" : "vs"}
                          </span>
                          <ToggleBtn
                            label="VIS"
                            active={current === "visiteur"}
                            onClick={() => toggle(m.domicile, m.visiteur, "visiteur")}
                          />
                        </div>

                        {/* Visiteur */}
                        <span
                          className="flex-1 text-sm truncate"
                          style={{
                            color: current === "visiteur" ? "var(--foreground)" : "var(--muted)",
                            fontWeight: current === "visiteur" ? 600 : 400,
                          }}
                        >
                          {m.visiteur}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Results */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium" style={{ color: "var(--muted)" }}>
              Probabilités {target === "top" ? "de montée" : "de relégation"}
            </span>
            {loading && (
              <span className="text-xs" style={{ color: "var(--accent)" }}>
                calcul…
              </span>
            )}
          </div>

          <div
            className="rounded-lg overflow-hidden"
            style={{
              border: "1px solid var(--border)",
              opacity: loading ? 0.6 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {results === null ? (
              <div className="py-8 text-center text-sm" style={{ color: "var(--muted)" }}>
                Chargement…
              </div>
            ) : (
              results.map((r, i) => (
                <ResultRow
                  key={r.Team.equipe}
                  result={r}
                  target={target}
                  showDivider={i < results.length - 1}
                />
              ))
            )}
          </div>

          <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
            {forcedCount === 0
              ? "Toggle des matchs pour voir l'impact sur les probas."
              : `${forcedCount} match${forcedCount > 1 ? "s" : ""} forcé${forcedCount > 1 ? "s" : ""}`}
          </p>
        </div>
      </div>
    </div>
  );
}

function ToggleBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-2 py-1 rounded text-xs font-mono font-medium transition-colors"
      style={
        active
          ? { background: "var(--accent)", color: "#fff" }
          : { background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }
      }
    >
      {label}
    </button>
  );
}

function ResultRow({
  result,
  target,
  showDivider,
}: {
  result: ProjectionResult;
  target: Target;
  showDivider: boolean;
}) {
  const pct = result.WinPct;

  const barColor =
    pct >= 60
      ? "rgb(34,197,94)"
      : pct >= 25
      ? "rgb(234,179,8)"
      : pct > 0
      ? "rgb(249,115,22)"
      : "rgb(75,85,99)";

  return (
    <div
      style={{
        borderBottom: showDivider ? "1px solid var(--border)" : undefined,
        opacity: pct === 0 ? 0.4 : 1,
      }}
    >
      <div className="flex items-center gap-2 px-4 py-2.5">
        <span className="w-5 text-xs font-mono text-center" style={{ color: "var(--muted)" }}>
          {result.Team.rang}
        </span>
        <span className="flex-1 text-sm truncate">{result.Team.equipe}</span>
        <span className="text-xs font-mono shrink-0" style={{ color: "var(--muted)" }}>
          {result.Team.pts}pts
        </span>
        <div className="w-14 text-right shrink-0">
          {pct === 0 ? (
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {target === "top" ? "éliminé" : "maintenu ✓"}
            </span>
          ) : pct >= 99.9 ? (
            <span className="text-xs font-semibold text-green-600">
              {target === "top" ? "assuré ✓" : "relégué"}
            </span>
          ) : (
            <span className="text-sm font-semibold font-mono" style={{ color: barColor }}>
              {pct.toFixed(0)}
              <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>%</span>
            </span>
          )}
        </div>
      </div>
      {pct > 0 && pct < 99.9 && (
        <div className="px-4 pb-2">
          <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }}>
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
