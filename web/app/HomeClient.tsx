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
      {/* URL input */}
      <form onSubmit={handleSubmit} className="mb-10">
        <label className="block text-sm font-medium mb-2">
          Colle une URL FFBB pour analyser une compétition
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://competitions.ffbb.com/ligues/idf/…/classement?phase=…&poule=…"
            disabled={loading}
            className="flex-1 rounded-lg px-4 py-2.5 text-sm font-mono min-w-0"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-5 py-2.5 rounded-lg text-sm font-medium shrink-0 transition-opacity"
            style={{
              background: "var(--accent)",
              color: "#fff",
              opacity: loading || !url.trim() ? 0.5 : 1,
            }}
          >
            {loading ? "Scraping…" : "Analyser"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm" style={{ color: "rgb(220,38,38)" }}>
            {error}
          </p>
        )}
      </form>

      {/* Existing competitions */}
      {competitions.length > 0 && (
        <>
          <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
            Compétitions déjà disponibles
          </p>
          <div className="grid gap-3">
            {competitions.map((c) => (
              <a
                key={c.id}
                href={`/${c.id}`}
                className="block rounded-lg px-5 py-4 transition-colors"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-medium">{c.competition}</span>
                  <span className="text-sm" style={{ color: "var(--muted)" }}>
                    {c.ligue}
                  </span>
                </div>
                <div className="text-xs mt-1 font-mono" style={{ color: "var(--muted)" }}>
                  {c.id}
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
