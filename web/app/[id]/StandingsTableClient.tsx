"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ProjectionResult, Match, Team } from "@/lib/api";

type Target = "top" | "bottom";

export type EnrichedTeam = {
  team: Team;
  form: ("W" | "L")[];
  difficulty: number;
  status: "safe" | "uncertain" | "danger";
  remainingCount: number;
};

type Props = {
  id: string;
  enriched: EnrichedTeam[];
  totalTeams: number;
  remainingMatches: Match[];
};

type ModalData = { team: Team; result: ProjectionResult } | null;
type TagInfo = { emoji: string; label: string; description: string } | null;

const norm = (name: string) => name.replace(/ - \d+$/, "").toLowerCase().trim();

export default function StandingsTableClient({ id, enriched, totalTeams, remainingMatches }: Props) {
  const [target, setTarget] = useState<Target>("top");
  const [n, setN] = useState(2);
  const [results, setResults] = useState<ProjectionResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalData>(null);
  const [tagInfo, setTagInfo] = useState<TagInfo>(null);
  const abortRef = useRef<AbortController | null>(null);

  const maxN = Math.min(4, Math.floor(totalTeams / 2));

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    const params = target === "top" ? `top=${n}` : `bottom=${n}`;
    fetch(`/api/competitions/${id}/projections?${params}`, { signal: abortRef.current.signal })
      .then((r) => r.json())
      .then((data: ProjectionResult[]) => setResults(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, target, n]);

  const projMap = new Map<string, ProjectionResult>();
  if (results) {
    for (const r of results) projMap.set(norm(r.Team.equipe), r);
  }

  function maitreDeSonDestin(teamName: string, result: ProjectionResult): boolean {
    if (target !== "top" || !results) return false;
    if (result.WinPct === 0 || result.WinPct >= 99.9) return false;

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

    const teamsAbove = results.filter((r) => {
      const rName = norm(r.Team.equipe);
      if (rName === teamName) return false;
      const effectiveMax = r.MaxPts - (ptsLostByOpponent.get(rName) ?? 0);
      return effectiveMax > result.MaxPts;
    }).length;

    return teamsAbove < n;
  }

  function computeTags(
    form: ("W" | "L")[],
    rang: number,
    maitre: boolean,
    derniereChance: boolean
  ): { emoji: string; label: string; description: string }[] {
    const tags: { emoji: string; label: string; description: string }[] = [];

    // Forme
    const last3 = form.slice(-3);
    const last5 = form.slice(-5);
    if (form.length >= 5 && last5.every((r) => r === "W")) {
      tags.push({ emoji: "⭐", label: "Série parfaite", description: "5 victoires consécutives sur les 5 derniers matchs." });
    } else if (form.length >= 3 && last3.every((r) => r === "W")) {
      tags.push({ emoji: "🔥", label: "En forme", description: "3 victoires consécutives sur les 3 derniers matchs." });
    }
    if (form.length >= 5 && last5.every((r) => r === "L")) {
      tags.push({ emoji: "💀", label: "En chute libre", description: "5 défaites consécutives sur les 5 derniers matchs." });
    } else if (form.length >= 3 && last3.every((r) => r === "L")) {
      tags.push({ emoji: "📉", label: "Passage à vide", description: "3 défaites consécutives sur les 3 derniers matchs." });
    }

    // Sur la ligne (1 place de la frontière)
    const boundary = target === "top" ? n : totalTeams - n + 1;
    if (rang === boundary || rang === boundary + (target === "top" ? 1 : -1)) {
      tags.push({ emoji: "⚖️", label: "Sur la ligne", description: `Cette équipe est à la frontière de la zone (place ${boundary}).` });
    }

    // Projection
    if (maitre) {
      tags.push({ emoji: "👑", label: "Maître de leur destin", description: "En gagnant tous leurs matchs restants, cette équipe est assurée d'atteindre la zone cible, quoi que fassent les adversaires." });
    }
    if (derniereChance) {
      tags.push({ emoji: "⚡", label: "Dernière chance", description: "Un seul scénario sur l'ensemble des combinaisons possibles permet à cette équipe d'atteindre la zone cible." });
    }

    return tags;
  }

  function dynamicStatus(rang: number): "safe" | "uncertain" | "danger" {
    if (target === "top") {
      if (rang <= n) return "safe";
      if (rang > totalTeams - n) return "danger";
    } else {
      if (rang > totalTeams - n) return "danger";
      if (rang <= n) return "safe";
    }
    return "uncertain";
  }

  const sorted = [...enriched].sort((a, b) => a.team.rang - b.team.rang);

  return (
    <div>
      {/* Legend */}
      <div className="flex gap-5 text-xs mb-4" style={{ color: "var(--muted)" }}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
          {target === "top" ? `Top ${n}` : "Hors relégation"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> Incertain
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
          {target === "top" ? "Zone de relégation" : `Bas ${n}`}
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-x-auto" style={{ border: "1px solid var(--border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-xs"
              style={{
                background: "var(--card)",
                color: "var(--muted)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <th className="py-3 px-4 text-left font-medium w-8">Rang</th>
              <th className="py-3 px-4 text-left font-medium">Équipe</th>
              <th className="py-3 px-3 text-center font-medium font-mono">Pts</th>
              <th className="py-3 px-3 text-center font-medium font-mono">V</th>
              <th className="py-3 px-3 text-center font-medium font-mono">D</th>
              <th className="py-3 px-3 text-center font-medium font-mono">+/-</th>
              <th className="py-3 px-2 text-center font-medium">Forme</th>
              <th className="py-3 px-4 text-center font-medium">Calendrier</th>

              {/* Probabilité : label en haut, toggle en dessous */}
              <th className="px-5 text-center font-medium" style={{ verticalAlign: "top" }}>
                <div className="flex flex-col items-center gap-1.5 pb-2 pt-2.5">
                  <span>
                    Probabilité{" "}
                    {loading && <span style={{ color: "var(--accent)" }}>·</span>}
                  </span>
                  <div
                    className="flex rounded-lg p-0.5 gap-0.5"
                    style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                  >
                    {(["top", "bottom"] as Target[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTarget(t)}
                        className="px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-colors"
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
                </div>
              </th>

              {/* Colonne tags : "Places concernées" + sélecteur à la ligne */}
              <th className="px-3 text-left font-medium" style={{ verticalAlign: "top" }}>
                <div className="flex flex-col items-start gap-1.5 pb-2 pt-2.5">
                  <span className="whitespace-nowrap">Places concernées</span>
                  <div
                    className="flex rounded-lg p-0.5 gap-0.5"
                    style={{ background: "var(--background)", border: "1px solid var(--border)" }}
                  >
                    {Array.from({ length: maxN }, (_, i) => i + 1).map((v) => (
                      <button
                        key={v}
                        onClick={() => setN(v)}
                        className="w-6 h-5 rounded text-[11px] font-mono font-medium transition-colors"
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
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ team, form, difficulty, remainingCount }, i) => {
              const result = projMap.get(norm(team.equipe));
              const teamName = norm(team.equipe);
              const status = dynamicStatus(team.rang);
              const maitre = result ? maitreDeSonDestin(teamName, result) : false;
              const derniereChance = result
                ? result.TotalScenarios > 0 && result.EstimatedScenarios === 1
                : false;
              const tags = computeTags(form, team.rang, maitre, derniereChance);

              return (
                <tr
                  key={team.equipe}
                  style={{
                    borderBottom: i < sorted.length - 1 ? "1px solid var(--border)" : undefined,
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
                  <td className="py-3 px-4 font-medium max-w-[160px] truncate">{team.equipe}</td>
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
                  <td className="py-3 px-2">
                    <FormDots form={form} />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <DifficultyBadge difficulty={difficulty} remaining={remainingCount} />
                  </td>
                  <td className="py-3 px-5 text-center">
                    <ProbaCell
                      result={result}
                      target={target}
                      loading={loading}
                      onOpenModal={result ? () => setModal({ team, result }) : undefined}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <div className="flex gap-0.5 flex-wrap">
                      {tags.map((tag) => (
                        <button
                          key={tag.emoji}
                          onClick={() => setTagInfo(tag)}
                          className="text-base leading-none transition-opacity hover:opacity-70"
                          title={tag.label}
                        >
                          {tag.emoji}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs mt-4" style={{ color: "var(--muted)" }}>
        Forme : 5 derniers matchs · Calendrier : difficulté des adversaires restants · 10M simulations H2H puis différentiel
      </p>

      {/* Modal scénarios */}
      {modal && (
        <ScenariosModal
          team={modal.team}
          result={modal.result}
          target={target}
          n={n}
          onClose={() => setModal(null)}
        />
      )}

      {/* Modal tag info */}
      {tagInfo && (
        <TagInfoModal info={tagInfo} onClose={() => setTagInfo(null)} />
      )}
    </div>
  );
}

// --- Sub-components ---

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
          className={`inline-flex w-4 h-4 rounded-sm text-[9px] font-bold items-center justify-center ${
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
    difficulty > 0.6 ? "text-red-500" : difficulty > 0.4 ? "text-amber-500" : "text-green-600";

  return <span className={`text-xs font-mono ${color}`}>{label}</span>;
}

function ProbaCell({
  result,
  target,
  loading,
  onOpenModal,
}: {
  result: ProjectionResult | undefined;
  target: Target;
  loading: boolean;
  onOpenModal?: () => void;
}) {
  if (loading || !result) {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-block w-10 h-3 rounded animate-pulse" style={{ background: "var(--border)" }} />
        <span className="inline-block w-16 h-1.5 rounded-full animate-pulse" style={{ background: "var(--border)" }} />
      </div>
    );
  }

  const pct = result.WinPct;

  const barColor =
    target === "bottom"
      ? pct >= 60 ? "rgb(220,38,38)" : pct >= 25 ? "rgb(234,179,8)" : pct > 0 ? "rgb(34,197,94)" : "rgb(75,85,99)"
      : pct >= 60 ? "rgb(34,197,94)" : pct >= 25 ? "rgb(234,179,8)" : pct > 0 ? "rgb(249,115,22)" : "rgb(75,85,99)";

  return (
    <div className="flex flex-col items-center gap-0.5">
      {pct === 0 ? (
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {target === "top" ? "éliminé" : "maintenu ✓"}
        </span>
      ) : pct >= 99.9 ? (
        <span
          className="text-xs font-semibold"
          style={{ color: target === "top" ? "rgb(22,163,74)" : "rgb(220,38,38)" }}
        >
          {target === "top" ? "assuré ✓" : "relégué"}
        </span>
      ) : (
        <>
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-semibold font-mono" style={{ color: barColor }}>
              {pct.toFixed(0)}
              <span className="text-xs font-normal" style={{ color: "var(--muted)" }}>%</span>
            </span>
            {result.TotalScenarios > 0 && onOpenModal && (
              <button
                onClick={onOpenModal}
                className="w-4 h-4 rounded-full text-[10px] font-bold leading-none transition-colors flex items-center justify-center"
                style={{
                  background: "var(--border)",
                  color: "var(--muted)",
                }}
              >
                +
              </button>
            )}
          </span>
          <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "var(--border)", width: 56 }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, background: barColor }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function ScenariosModal({
  team,
  result,
  target,
  n,
  onClose,
}: {
  team: Team;
  result: ProjectionResult;
  target: Target;
  n: number;
  onClose: () => void;
}) {
  const isTop = target === "top";
  const placesLabel = isTop ? `${n} première${n > 1 ? "s" : ""} place${n > 1 ? "s" : ""}` : `${n} dernière${n > 1 ? "s" : ""} place${n > 1 ? "s" : ""}`;
  const actionLabel = isTop ? "monte" : "descend";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-base mb-0.5">{team.equipe}</h3>
        <p className="text-xs mb-5" style={{ color: "var(--muted)" }}>
          {isTop ? "Probabilité de montée" : "Probabilité de relégation"} · {placesLabel}
        </p>

        <div className="space-y-3 text-sm">
          <div
            className="rounded-lg px-4 py-3"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          >
            <span className="text-2xl font-bold font-mono" style={{ color: "var(--foreground)" }}>
              {result.TotalScenarios.toLocaleString("fr-FR")}
            </span>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              scénarios totaux simulés
            </p>
          </div>

          <div
            className="rounded-lg px-4 py-3"
            style={{ background: "var(--background)", border: "1px solid var(--border)" }}
          >
            <span className="text-2xl font-bold font-mono" style={{ color: "var(--accent)" }}>
              {result.EstimatedScenarios.toLocaleString("fr-FR")}
            </span>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              scénarios où <strong style={{ color: "var(--foreground)" }}>{team.equipe}</strong>{" "}
              {actionLabel} (top {placesLabel})
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full text-xs py-2 rounded-lg transition-colors"
          style={{ background: "var(--background)", color: "var(--muted)", border: "1px solid var(--border)" }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}

function TagInfoModal({
  info,
  onClose,
}: {
  info: { emoji: string; label: string; description: string };
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl p-6 max-w-xs w-full mx-4 shadow-xl text-center"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-4xl mb-3">{info.emoji}</div>
        <h3 className="font-semibold text-base mb-2">{info.label}</h3>
        <p className="text-sm" style={{ color: "var(--muted)" }}>{info.description}</p>
        <button
          onClick={onClose}
          className="mt-5 w-full text-xs py-2 rounded-lg transition-colors"
          style={{ background: "var(--background)", color: "var(--muted)", border: "1px solid var(--border)" }}
        >
          Fermer
        </button>
      </div>
    </div>
  );
}
