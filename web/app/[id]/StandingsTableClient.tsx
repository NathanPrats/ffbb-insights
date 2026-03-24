"use client";

import { useEffect, useRef, useState } from "react";
import type { Journee, ProjectionResult, Match, Team } from "@/lib/api";

type Target = "top" | "bottom";
type Winner = "domicile" | "visiteur";
type OverrideEntry = { winner: Winner; margin: number };
type Overrides = Record<string, OverrideEntry>;

type AdjStats = { pts: number; gagnes: number; perdus: number; bp: number; bc: number };

const MARGIN_PRESETS = [5, 10, 15, 20, 30];
const DEFAULT_MARGIN = 10;

function computeAdjustments(overrides: Overrides): Map<string, AdjStats> {
  const adj = new Map<string, AdjStats>();
  const get = (k: string): AdjStats =>
    adj.get(k) ?? { pts: 0, gagnes: 0, perdus: 0, bp: 0, bc: 0 };

  for (const [key, { winner, margin }] of Object.entries(overrides)) {
    const [dom, vis] = key.split("__");
    const winScore = 70 + margin;
    const loseScore = 70;
    const dk = norm(dom);
    const vk = norm(vis);
    const d = get(dk);
    const v = get(vk);

    if (winner === "domicile") {
      adj.set(dk, { pts: d.pts + 2, gagnes: d.gagnes + 1, perdus: d.perdus, bp: d.bp + winScore, bc: d.bc + loseScore });
      adj.set(vk, { pts: v.pts, gagnes: v.gagnes, perdus: v.perdus + 1, bp: v.bp + loseScore, bc: v.bc + winScore });
    } else {
      adj.set(dk, { pts: d.pts, gagnes: d.gagnes, perdus: d.perdus + 1, bp: d.bp + loseScore, bc: d.bc + winScore });
      adj.set(vk, { pts: v.pts + 2, gagnes: v.gagnes + 1, perdus: v.perdus, bp: v.bp + winScore, bc: v.bc + loseScore });
    }
  }
  return adj;
}

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
  journees: Journee[];
  header: {
    name: string;
    ligue: string;
    comite: string;
    scrapedAt: string | null;
  };
};

type ModalData = { team: Team; result: ProjectionResult } | null;
type TagInfo = { emoji: string; label: string; description: string } | null;

type ShareImageData = {
  teamName: string;
  pct: number;
  overrides: Overrides;
  target: Target;
  competitionName: string;
};

async function generateShareImage(data: ShareImageData): Promise<string> {
  const W = 1080, H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const FONT = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif";
  const WHITE = "#ffffff";
  const cx = W / 2;
  const isTop = data.target === "top";

  // Background: logo image
  await new Promise<void>((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.max(W / img.width, H / img.height);
      const sw = img.width * scale;
      const sh = img.height * scale;
      ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);
      resolve();
    };
    img.onerror = () => {
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#1a0a0f");
      bg.addColorStop(1, "#0a0808");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      resolve();
    };
    img.src = "/logo-1.jpg";
  });

  // Dark overlay
  const overlay = ctx.createLinearGradient(0, 0, 0, H);
  overlay.addColorStop(0, "rgba(6,3,12,0.55)");
  overlay.addColorStop(0.4, "rgba(6,3,12,0.72)");
  overlay.addColorStop(0.7, "rgba(6,3,12,0.85)");
  overlay.addColorStop(1, "rgba(6,3,12,0.93)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.font = `600 22px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.textAlign = "left";
  ctx.fillText("ffbb insights", 60, 68);

  ctx.font = `400 20px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.textAlign = "right";
  let compName = data.competitionName;
  while (ctx.measureText(compName).width > W - 280 && compName.length > 0) compName = compName.slice(0, -1);
  if (compName !== data.competitionName) compName += "…";
  ctx.fillText(compName, W - 60, 68);

  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 86);
  ctx.lineTo(W - 60, 86);
  ctx.stroke();

  // Team name
  const TOP = 545; // contenu commence à ~50% de l'image
  ctx.font = `700 52px ${FONT}`;
  ctx.fillStyle = WHITE;
  ctx.textAlign = "center";
  let teamDisplay = data.teamName.replace(/ - \d+$/, "");
  while (ctx.measureText(teamDisplay).width > W - 80 && teamDisplay.length > 0) teamDisplay = teamDisplay.slice(0, -1);
  if (teamDisplay !== data.teamName.replace(/ - \d+$/, "")) teamDisplay += "…";
  ctx.fillText(teamDisplay, cx, TOP);

  // Main content: percentage or status word
  const certColor = isTop ? "#4ade80" : "#f87171";
  const pctColor = isTop
    ? data.pct >= 60 ? "#4ade80" : data.pct >= 25 ? "#fbbf24" : "#fb923c"
    : data.pct >= 60 ? "#f87171" : data.pct >= 25 ? "#fbbf24" : "#4ade80";

  if (data.pct >= 99.9) {
    ctx.font = `800 108px ${FONT}`;
    ctx.fillStyle = certColor;
    ctx.textAlign = "center";
    ctx.fillText(isTop ? "ASSURÉ" : "RELÉGUÉ", cx, TOP + 100);
    ctx.font = `500 34px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(isTop ? "de monter ✓" : "impossible à éviter", cx, TOP + 148);
  } else if (data.pct === 0) {
    ctx.font = `800 100px ${FONT}`;
    ctx.fillStyle = certColor;
    ctx.textAlign = "center";
    ctx.fillText(isTop ? "ÉLIMINÉ" : "MAINTIEN", cx, TOP + 100);
    ctx.font = `500 34px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(isTop ? "ne peut plus monter" : "assuré de rester ✓", cx, TOP + 148);
  } else {
    ctx.font = `800 130px ${FONT}`;
    ctx.fillStyle = pctColor;
    ctx.textAlign = "center";
    ctx.fillText(`${data.pct.toFixed(0)}%`, cx, TOP + 115);
    ctx.font = `500 34px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText(isTop ? "de chances de monter" : "de chances de descendre", cx, TOP + 165);
  }

  // Overrides
  const overrideEntries = Object.entries(data.overrides);
  if (overrideEntries.length > 0) {
    let y = TOP + 245;

    ctx.font = `500 22px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.textAlign = "center";
    ctx.fillText("Si :", cx, y);
    y += 40;

    for (const [key, { winner, margin }] of overrideEntries.slice(0, 4)) {
      const [dom, vis] = key.split("__");
      const winnerName = winner === "domicile" ? dom : vis;
      const loserName = winner === "domicile" ? vis : dom;

      ctx.font = `600 22px ${FONT}`;
      const ww = ctx.measureText(winnerName).width;
      ctx.font = `400 22px ${FONT}`;
      const bw = ctx.measureText(" bat ").width;
      const lw = ctx.measureText(loserName).width;
      ctx.font = `500 17px ${FONT}`;
      const mw = ctx.measureText(` +${margin}`).width;
      let xPos = cx - (ww + bw + lw + mw) / 2;

      // Accent bar
      ctx.fillStyle = "#a5273c";
      ctx.fillRect(xPos - 12, y - 15, 3, 20);

      ctx.textAlign = "left";
      ctx.font = `600 22px ${FONT}`;
      ctx.fillStyle = WHITE;
      ctx.fillText(winnerName, xPos, y);
      xPos += ww;

      ctx.font = `400 22px ${FONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillText(" bat ", xPos, y);
      xPos += bw;

      ctx.font = `400 22px ${FONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillText(loserName, xPos, y);
      xPos += lw;

      ctx.font = `500 17px ${FONT}`;
      ctx.fillStyle = "rgba(165,39,60,0.85)";
      ctx.fillText(` +${margin}`, xPos, y);

      y += 34;
    }

    if (overrideEntries.length > 4) {
      ctx.font = `400 17px ${FONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.textAlign = "center";
      ctx.fillText(`+ ${overrideEntries.length - 4} autre(s)…`, cx, y);
    }
  }

  // Footer
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, H - 54);
  ctx.lineTo(W - 60, H - 54);
  ctx.stroke();

  ctx.font = `400 16px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.textAlign = "left";
  ctx.fillText("ffbb-insights.vercel.app", 60, H - 24);
  ctx.textAlign = "right";
  ctx.fillText(new Date().toLocaleDateString("fr-FR"), W - 60, H - 24);

  return canvas.toDataURL("image/png");
}

const norm = (name: string) => name.replace(/ - \d+$/, "").toLowerCase().trim();

export default function StandingsTableClient({ id, enriched, totalTeams, remainingMatches, journees, header }: Props) {
  const [target, setTarget] = useState<Target>("top");
  const [n, setN] = useState(2);
  const [results, setResults] = useState<ProjectionResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalData>(null);
  const [tagInfo, setTagInfo] = useState<TagInfo>(null);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [simulModalOpen, setSimulModalOpen] = useState(false);
  const [shareImageUrl, setShareImageUrl] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const maxN = Math.min(4, Math.floor(totalTeams / 2));

  useEffect(() => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setLoading(true);

    const hasOverrides = Object.keys(overrides).length > 0;

    if (hasOverrides) {
      const targetPositions =
        target === "top"
          ? Array.from({ length: n }, (_, i) => i + 1)
          : Array.from({ length: n }, (_, i) => totalTeams - n + 1 + i);
      const overridesList = Object.entries(overrides).map(([key, { winner, margin }]) => {
        const [domicile, visiteur] = key.split("__");
        return { domicile, visiteur, winner, margin };
      });
      fetch(`/api/competitions/${id}/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: overridesList, target_positions: targetPositions }),
        signal: abortRef.current.signal,
      })
        .then((r) => r.json())
        .then((data: ProjectionResult[]) => setResults(data))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      const params = target === "top" ? `top=${n}` : `bottom=${n}`;
      fetch(`/api/competitions/${id}/projections?${params}`, { signal: abortRef.current.signal })
        .then((r) => r.json())
        .then((data: ProjectionResult[]) => setResults(data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [id, target, n, overrides]);

  function toggleOverride(domicile: string, visiteur: string, winner: Winner) {
    const key = `${domicile}__${visiteur}`;
    setOverrides((prev) => {
      if (prev[key]?.winner === winner) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: { winner, margin: prev[key]?.margin ?? DEFAULT_MARGIN } };
    });
  }

  function setOverrideMargin(key: string, margin: number) {
    setOverrides((prev) => {
      if (!prev[key]) return prev;
      return { ...prev, [key]: { ...prev[key], margin } };
    });
  }

  function removeOverride(key: string) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleShare(team: Team, result: ProjectionResult) {
    const url = await generateShareImage({
      teamName: team.equipe,
      pct: result.WinPct,
      overrides,
      target,
      competitionName: header.name,
    });
    setShareImageUrl(url);
  }

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

    const boundary = target === "top" ? n : totalTeams - n + 1;
    if (rang === boundary || rang === boundary + (target === "top" ? 1 : -1)) {
      tags.push({ emoji: "⚖️", label: "Sur la ligne", description: `Cette équipe est à la frontière de la zone (place ${boundary}).` });
    }

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

  const forcedCount = Object.keys(overrides).length;
  const adjustments = computeAdjustments(overrides);

  const sorted = [...enriched].sort((a, b) => {
    if (forcedCount > 0) {
      const adjA = adjustments.get(norm(a.team.equipe));
      const adjB = adjustments.get(norm(b.team.equipe));
      const ptsA = a.team.pts + (adjA?.pts ?? 0);
      const ptsB = b.team.pts + (adjB?.pts ?? 0);
      if (ptsA !== ptsB) return ptsB - ptsA;
      const diffA = (a.team.bp + (adjA?.bp ?? 0)) - (a.team.bc + (adjA?.bc ?? 0));
      const diffB = (b.team.bp + (adjB?.bp ?? 0)) - (b.team.bc + (adjB?.bc ?? 0));
      return diffB - diffA;
    }
    return a.team.rang - b.team.rang;
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.45)" }}>
          Compétition sélectionnée
        </p>
        <div className="flex items-start gap-6">
          <div className="flex-1">
            <p className="text-sm mb-1" style={{ color: "rgba(255,255,255,0.5)" }}>
              {[header.ligue, header.comite].filter(Boolean).join(" · ")}
            </p>
            <h1 className="text-2xl font-semibold" style={{ color: "#fff" }}>
              {header.name}
            </h1>
            {header.scrapedAt && (
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                Classement le {header.scrapedAt}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              onClick={() => setSimulModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: "var(--accent)",
                color: "#fff",
                boxShadow: "0 0 24px rgba(165,39,60,0.4)",
              }}
            >
              🔮 Simuler
            </button>
            {forcedCount > 0 && (
              <button
                onClick={() => setOverrides({})}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: "var(--card)", color: "var(--muted)", border: "1px solid var(--border)" }}
              >
                Réinitialiser ({forcedCount})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Override chips */}
      {forcedCount > 0 && (
        <div className="mb-5">
          <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: "var(--muted)" }}>
            Résultats simulés :
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(overrides).map(([key, { winner, margin }]) => {
              const [domicile, visiteur] = key.split("__");
              const winnerName = winner === "domicile" ? domicile : visiteur;
              const loserName = winner === "domicile" ? visiteur : domicile;
              return (
                <span
                  key={key}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                  style={{
                    background: "rgba(165,39,60,0.18)",
                    color: "var(--accent)",
                    border: "1px solid rgba(165,39,60,0.45)",
                  }}
                >
                  <span className="font-semibold">{winnerName}</span>
                  <span style={{ opacity: 0.5 }}>›</span>
                  <span style={{ opacity: 0.7 }}>{loserName}</span>
                  <span style={{ opacity: 0.6 }}>+{margin}</span>
                  <button
                    onClick={() => removeOverride(key)}
                    className="opacity-50 hover:opacity-100 leading-none text-sm ml-0.5"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

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
      <div className="rounded-lg overflow-x-auto" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
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

              <th className="px-5 text-center font-medium" style={{ verticalAlign: "top" }}>
                <div className="flex flex-col items-center gap-1.5 pb-2 pt-2.5">
                  <span>
                    Probabilité{" "}
                    {loading && <span style={{ color: "var(--accent)" }}>·</span>}
                    {forcedCount > 0 && !loading && (
                      <span style={{ color: "var(--accent)" }}> 🔮</span>
                    )}
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
              const adj = adjustments.get(teamName);
              const newRang = i + 1;
              const rankDiff = forcedCount > 0 ? team.rang - newRang : 0;
              const status = dynamicStatus(newRang);
              const maitre = result ? maitreDeSonDestin(teamName, result) : false;
              const derniereChance = result
                ? result.TotalScenarios > 0 && result.EstimatedScenarios === 1
                : false;
              const tags = computeTags(form, newRang, maitre, derniereChance);

              const adjPts = team.pts + (adj?.pts ?? 0);
              const adjGagnes = team.gagnes + (adj?.gagnes ?? 0);
              const adjPerdus = team.perdus + (adj?.perdus ?? 0);
              const adjDiff = (team.bp + (adj?.bp ?? 0)) - (team.bc + (adj?.bc ?? 0));
              const origDiff = team.bp - team.bc;

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
                    <div className="flex items-center gap-1.5">
                      <StatusDot status={status} />
                      <span className="font-mono text-xs" style={{ color: "var(--muted)" }}>
                        {newRang}
                      </span>
                      {rankDiff > 0 && (
                        <span className="text-[10px] font-bold text-green-500">↑{rankDiff}</span>
                      )}
                      {rankDiff < 0 && (
                        <span className="text-[10px] font-bold text-red-500">↓{Math.abs(rankDiff)}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-medium max-w-[160px] truncate">{team.equipe}</td>
                  <td className="py-3 px-3 text-center font-mono font-semibold">
                    {adjPts}
                    {adj?.pts ? <Delta v={adj.pts} /> : null}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-green-600">
                    {adjGagnes}
                    {adj?.gagnes ? <Delta v={adj.gagnes} /> : null}
                  </td>
                  <td className="py-3 px-3 text-center font-mono text-red-500">
                    {adjPerdus}
                    {adj?.perdus ? <Delta v={adj.perdus} neg /> : null}
                  </td>
                  <td
                    className="py-3 px-3 text-center font-mono text-xs"
                    style={{ color: adjDiff >= 0 ? "rgb(22,163,74)" : "rgb(220,38,38)" }}
                  >
                    {adjDiff > 0 ? "+" : ""}
                    {adjDiff}
                    {adj && adjDiff !== origDiff ? <Delta v={adjDiff - origDiff} /> : null}
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
                      onShare={result ? () => handleShare(team, result) : undefined}
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

      {/* Simul modal */}
      {simulModalOpen && (
        <SimulModal
          journees={journees}
          overrides={overrides}
          onToggle={toggleOverride}
          onSetMargin={setOverrideMargin}
          onClose={() => setSimulModalOpen(false)}
        />
      )}

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

      {/* Share modal */}
      {shareImageUrl && (
        <ShareModal imageUrl={shareImageUrl} onClose={() => setShareImageUrl(null)} />
      )}
    </div>
  );
}

// --- Sub-components ---

function Delta({ v, neg }: { v: number; neg?: boolean }) {
  const positive = neg ? v < 0 : v > 0;
  return (
    <span
      className="text-[10px] font-normal ml-0.5"
      style={{ color: positive ? "rgb(22,163,74)" : "rgb(220,38,38)" }}
    >
      {v > 0 ? `+${v}` : v}
    </span>
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
  onShare,
}: {
  result: ProjectionResult | undefined;
  target: Target;
  loading: boolean;
  onOpenModal?: () => void;
  onShare?: () => void;
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
        <span className="flex items-center gap-1">
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {target === "top" ? "éliminé" : "maintenu ✓"}
          </span>
          {onShare && (
            <button onClick={onShare} title="Partager" className="opacity-30 hover:opacity-80 text-[10px] leading-none transition-opacity" style={{ color: "var(--muted)" }}>↗</button>
          )}
        </span>
      ) : pct >= 99.9 ? (
        <span className="flex items-center gap-1">
          <span
            className="text-xs font-semibold"
            style={{ color: target === "top" ? "rgb(22,163,74)" : "rgb(220,38,38)" }}
          >
            {target === "top" ? "assuré ✓" : "relégué"}
          </span>
          {onShare && (
            <button onClick={onShare} title="Partager" className="opacity-40 hover:opacity-90 text-[10px] leading-none transition-opacity" style={{ color: target === "top" ? "rgb(22,163,74)" : "rgb(220,38,38)" }}>↗</button>
          )}
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
            {onShare && (
              <button
                onClick={onShare}
                title="Partager ce résultat"
                className="w-4 h-4 rounded-full text-[10px] leading-none transition-opacity hover:opacity-100 flex items-center justify-center opacity-40"
                style={{
                  background: "var(--border)",
                  color: "var(--muted)",
                }}
              >
                ↗
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

function SimulModal({
  journees,
  overrides,
  onToggle,
  onSetMargin,
  onClose,
}: {
  journees: Journee[];
  overrides: Overrides;
  onToggle: (domicile: string, visiteur: string, winner: Winner) => void;
  onSetMargin: (key: string, margin: number) => void;
  onClose: () => void;
}) {
  const forcedCount = Object.keys(overrides).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl w-full mx-4 shadow-xl flex flex-col"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          maxWidth: 520,
          maxHeight: "85vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <h3 className="font-semibold text-base">🔮 Simuler les matchs restants</h3>
            {forcedCount > 0 ? (
              <p className="text-xs mt-0.5" style={{ color: "var(--accent)" }}>
                {forcedCount} match{forcedCount > 1 ? "s" : ""} forcé{forcedCount > 1 ? "s" : ""}
              </p>
            ) : (
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                Cliquez sur DOM ou VIS pour forcer un résultat
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-sm"
            style={{ color: "var(--muted)", background: "var(--background)", border: "1px solid var(--border)" }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable matches */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {journees.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: "var(--muted)" }}>
              Tous les matchs ont été joués.
            </p>
          ) : (
            journees.map((j) => {
              const remaining = j.matchs.filter((m) => !m.joue);
              if (remaining.length === 0) return null;
              return (
                <div key={j.date}>
                  <div className="text-xs font-mono mb-2" style={{ color: "var(--muted)" }}>
                    {formatDate(j.date)}
                  </div>
                  <div
                    className="rounded-lg overflow-hidden"
                    style={{ border: "1px solid var(--border)", background: "var(--background)" }}
                  >
                    {remaining.map((m, i) => {
                      const key = `${m.domicile}__${m.visiteur}`;
                      const current = overrides[key];
                      return (
                        <div
                          key={key}
                          style={{
                            borderBottom: i < remaining.length - 1 ? "1px solid var(--border)" : undefined,
                            background: current ? "rgba(165,39,60,0.04)" : undefined,
                          }}
                        >
                          <div className="flex items-center gap-3 px-4 py-3">
                            <span
                              className="flex-1 text-sm text-right truncate"
                              style={{
                                color: current?.winner === "domicile" ? "var(--foreground)" : "var(--muted)",
                                fontWeight: current?.winner === "domicile" ? 600 : 400,
                              }}
                            >
                              {m.domicile}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <ToggleBtn
                                label="DOM"
                                active={current?.winner === "domicile"}
                                onClick={() => onToggle(m.domicile, m.visiteur, "domicile")}
                              />
                              <span className="text-xs w-4 text-center" style={{ color: "var(--muted)" }}>
                                {current ? "·" : "vs"}
                              </span>
                              <ToggleBtn
                                label="VIS"
                                active={current?.winner === "visiteur"}
                                onClick={() => onToggle(m.domicile, m.visiteur, "visiteur")}
                              />
                            </div>
                            <span
                              className="flex-1 text-sm truncate"
                              style={{
                                color: current?.winner === "visiteur" ? "var(--foreground)" : "var(--muted)",
                                fontWeight: current?.winner === "visiteur" ? 600 : 400,
                              }}
                            >
                              {m.visiteur}
                            </span>
                          </div>
                          {current && (
                            <div className="flex items-center gap-1.5 px-4 pb-2.5">
                              <span className="text-[11px] mr-1" style={{ color: "var(--muted)" }}>Écart :</span>
                              {MARGIN_PRESETS.map((p) => (
                                <button
                                  key={p}
                                  onClick={() => onSetMargin(key, p)}
                                  className="px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors"
                                  style={
                                    current.margin === p
                                      ? { background: "var(--accent)", color: "#fff" }
                                      : { background: "var(--background)", color: "var(--muted)", border: "1px solid var(--border)" }
                                  }
                                >
                                  +{p}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Appliquer
          </button>
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
          : { background: "var(--background)", color: "var(--muted)", border: "1px solid var(--border)" }
      }
    >
      {label}
    </button>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
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

function ShareModal({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function handleDownload() {
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = "ffbb-insights.png";
    a.click();
  }

  async function handleCopy() {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      handleDownload();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="rounded-xl overflow-hidden shadow-2xl mx-4 flex flex-col"
        style={{ background: "var(--card)", border: "1px solid var(--border)", maxWidth: 620, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <h3 className="font-semibold text-base">Partager ce résultat</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-sm"
            style={{ color: "var(--muted)", background: "var(--background)", border: "1px solid var(--border)" }}
          >
            ✕
          </button>
        </div>
        <div className="p-4">
          <img src={imageUrl} alt="Résultat simulé" className="w-full rounded-lg" style={{ border: "1px solid var(--border)" }} />
        </div>
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={handleDownload}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Télécharger
          </button>
          <button
            onClick={handleCopy}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{
              background: copied ? "rgba(22,163,74,0.15)" : "var(--background)",
              color: copied ? "rgb(22,163,74)" : "var(--foreground)",
              border: "1px solid var(--border)",
            }}
          >
            {copied ? "Copié ✓" : "Copier l'image"}
          </button>
        </div>
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

