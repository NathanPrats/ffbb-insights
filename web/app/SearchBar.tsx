"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { scrapeCompetition } from "@/lib/api";

const FFBB_URL_PATTERN = /^https?:\/\/competitions\.ffbb\.com\/.+\?.*phase=.+&.*poule=.+/;

export default function SearchBar() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValid = FFBB_URL_PATTERN.test(url.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await scrapeCompetition(url.trim());
      router.refresh();
      router.push(`/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mb-8">
      <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
        Ajouter un championnat depuis une URL FFBB
      </p>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
          placeholder="https://competitions.ffbb.com/ligues/idf/…?phase=…&poule=…"
          disabled={loading}
          className="flex-1 rounded-lg px-4 py-2 text-sm font-mono min-w-0"
          style={{
            background: "var(--card)",
            border: `1px solid ${error ? "var(--danger, #ef4444)" : "var(--border)"}`,
            color: "inherit",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={!isValid || loading}
          className="rounded-lg px-4 py-2 text-sm font-medium shrink-0 transition-opacity"
          style={{
            background: "var(--foreground)",
            color: "var(--background)",
            opacity: !isValid || loading ? 0.4 : 1,
            cursor: !isValid || loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Scraping…" : "Ajouter"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-sm" style={{ color: "var(--danger, #ef4444)" }}>
          {error}
        </p>
      )}
    </form>
  );
}
