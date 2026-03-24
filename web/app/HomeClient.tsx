"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Competition } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";

type Props = {
  competitions: Competition[];
};

export default function HomeClient({ competitions }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/competitions/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erreur inconnue");
        return;
      }

      router.push(`/${data.id}`);
    } catch {
      setError("Impossible de joindre l'API. Lance make dev d'abord.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {/* Hero — logo seul, pas de titre texte */}
      <div className="flex flex-col items-center text-center mb-12 pt-4">
        <img
          src="/logo-2.jpg"
          alt="FFBB Simulation"
          style={{
            width: 180,
            height: 180,
            borderRadius: 36,
            objectFit: "cover",
            boxShadow: "0 0 80px rgba(165, 39, 60, 0.55), 0 0 140px rgba(53, 37, 112, 0.4)",
            marginBottom: 32,
          }}
        />
        <p
          className="text-base max-w-md leading-relaxed"
          style={{ color: "rgba(255,255,255,0.85)" }}
        >
          <span style={{ color: "#e06070", fontWeight: 600 }}>Analysez votre poule FFBB</span>{" "}
          — classement, matchs restants et probabilités de{" "}
          <span style={{ color: "#e06070", fontWeight: 600 }}>montée</span> et{" "}
          <span style={{ color: "#e06070", fontWeight: 600 }}>descente</span>{" "}
          en simulation !
        </p>
      </div>

      {/* URL form — carte blanche */}
      <div
        className="rounded-2xl p-5 mb-4"
        style={{
          background: "#ffffff",
          border: "1px solid #ddd6ec",
          boxShadow: "0 4px 24px rgba(29,36,68,0.18)",
        }}
      >
        <p
          className="text-xs font-semibold mb-3 uppercase tracking-widest"
          style={{ color: "#756585" }}
        >
          Analyser une compétition
        </p>
        <form onSubmit={handleSubmit}>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://competitions.ffbb.com/ligues/idf/…/classement?phase=…&poule=…"
              disabled={loading}
              className="flex-1 rounded-xl px-4 py-3 text-xs font-mono min-w-0"
              style={{
                background: "#f0ecf8",
                border: "1px solid #ddd6ec",
                color: "#1a1f3c",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="px-5 py-3 rounded-xl text-sm font-semibold shrink-0 transition-all"
              style={{
                background: loading || !url.trim() ? "rgba(165,39,60,0.35)" : "#A5273C",
                color: "#fff",
                cursor: loading || !url.trim() ? "not-allowed" : "pointer",
                boxShadow: !loading && url.trim() ? "0 0 16px rgba(165,39,60,0.4)" : "none",
              }}
            >
              {loading ? "Scraping…" : "Analyser"}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm" style={{ color: "#c0192e" }}>
              {error}
            </p>
          )}
        </form>
      </div>

      {/* Guide URL */}
      <UrlGuide />

      {/* Competition mosaic */}
      {competitions.length > 0 && (
        <div className="mt-10">
          <p
            className="text-xs font-semibold mb-4 uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Compétitions déjà chargées :
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {competitions.map((c) => (
              <CompetitionCard key={c.id} competition={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UrlGuide() {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-2xl overflow-hidden mb-2"
      style={{
        background: "#ffffff",
        border: "1px solid #ddd6ec",
        boxShadow: "0 4px 24px rgba(29,36,68,0.18)",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        style={{ cursor: "pointer" }}
      >
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#756585" }}>
          Comment trouver l&apos;URL sur le site FFBB ?
        </span>
        <span
          style={{
            color: "#756585",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.2s",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ›
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t" style={{ borderColor: "#ddd6ec" }}>
          <div className="space-y-3 mt-4">
            <Step n={1} text="Rendez-vous sur competitions.ffbb.com" />
            <Step n={2} text="Naviguez jusqu'à votre ligue → comité → compétition" />
            <Step n={3} text={"Cliquez sur l\u2019onglet \u00abClassement\u00bb"} />
            <Step n={4} text="Sélectionnez votre Phase et votre Poule dans les menus déroulants" />
            <Step n={5} text="Copiez l'URL complète depuis la barre d'adresse" />
          </div>

          <div
            className="mt-4 rounded-xl px-4 py-3"
            style={{ background: "#f0ecf8", border: "1px solid #ddd6ec" }}
          >
            <p className="text-xs mb-1.5" style={{ color: "#756585" }}>
              Exemple d&apos;URL valide
            </p>
            <p className="text-xs font-mono break-all leading-relaxed" style={{ color: "#1a1f3c" }}>
              {"https://competitions.ffbb.com/ligues/"}
              <span style={{ color: "#A5273C" }}>idf</span>
              {"/comites/"}
              <span style={{ color: "#A5273C" }}>0078</span>
              {"/competitions/"}
              <span style={{ color: "#A5273C" }}>dm3</span>
              {"/classement?phase="}
              <span style={{ color: "#A5273C" }}>2000000XXXXXXX</span>
              {"&poule="}
              <span style={{ color: "#A5273C" }}>2000000XXXXXXX</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
        style={{ background: "#A5273C", color: "#fff" }}
      >
        {n}
      </span>
      <p className="text-sm leading-relaxed" style={{ color: "#1a1f3c" }}>
        {text}
      </p>
    </div>
  );
}

function CompetitionCard({ competition: c }: { competition: Competition }) {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href={`/${c.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="block rounded-xl p-3 transition-all"
      style={{
        background: hovered ? "#A5273C" : "#ffffff",
        border: hovered ? "1px solid #A5273C" : "1px solid #ddd6ec",
        boxShadow: hovered
          ? "0 4px 20px rgba(165,39,60,0.35)"
          : "0 2px 10px rgba(29,36,68,0.12)",
        transform: hovered ? "translateY(-2px)" : "none",
        transition: "all 0.18s ease",
      }}
    >
      <div className="space-y-1">
        {c.ligue && <Row label="ligue" value={c.ligue} hovered={hovered} />}
        {c.comite && <Row label="comité" value={c.comite} hovered={hovered} />}
        <Row label="compét." value={c.competition} hovered={hovered} highlight />
        {c.genre && <Row label="genre" value={c.genre} hovered={hovered} />}
      </div>
    </a>
  );
}

function Row({
  label,
  value,
  hovered,
  highlight = false,
}: {
  label: string;
  value: string;
  hovered: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1">
      <span
        className="text-[10px] sm:text-xs w-12 shrink-0"
        style={{ color: hovered ? "rgba(255,255,255,0.65)" : "#756585" }}
      >
        {label}
      </span>
      <span
        className="text-xs sm:text-sm font-mono truncate"
        style={{
          color: hovered ? "#ffffff" : "#1a1f3c",
          fontWeight: highlight ? 600 : 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}
