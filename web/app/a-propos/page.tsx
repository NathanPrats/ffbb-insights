import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "À propos — FFBB Insights",
  description: "FFBB Insights est un projet fan open-source pour analyser et simuler les championnats de basketball FFBB.",
};

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto py-8">
      {/* Header */}
      <div className="rounded-xl p-7 mb-8" style={{ background: "#000" }}>
        <div className="flex items-center gap-2 mb-4">
          <span
            className="text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full"
            style={{ background: "rgba(165,39,60,0.25)", color: "#f87171", border: "1px solid rgba(165,39,60,0.5)" }}
          >
            Beta
          </span>
        </div>
        <h1 className="text-3xl font-bold mb-3" style={{ color: "#fff" }}>
          À propos de FFBB Insights
        </h1>
        <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
          Un outil d'analyse fait par un fan, pour les fans de basketball FFBB.
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-8">

        {/* What */}
        <section
          className="rounded-xl p-6"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--foreground)" }}>
            🏀 C'est quoi ?
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--muted)" }}>
            FFBB Insights scrappe en temps réel les classements et calendriers depuis{" "}
            <span style={{ color: "var(--foreground)" }}>competitions.ffbb.com</span> et les enrichit
            avec des analyses que le site officiel ne propose pas.
          </p>
          <ul className="space-y-2 text-sm" style={{ color: "var(--muted)" }}>
            {[
              "Probabilités de montée et de relégation via simulation Monte Carlo",
              "Simulateur de scénarios — forcer des résultats et voir l'impact en temps réel",
              "Partage d'image — générer une carte à partager sur les réseaux",
              "Indicateurs de forme, difficulté du calendrier restant",
              "Ajout de n'importe quel championnat FFBB via son URL",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2">
                <span style={{ color: "var(--accent)" }} className="mt-0.5 shrink-0">›</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Beta disclaimer */}
        <section
          className="rounded-xl p-6"
          style={{ background: "#000", border: "1px solid rgba(165,39,60,0.4)" }}
        >
          <h2 className="text-lg font-semibold mb-3" style={{ color: "#fff" }}>
            ⚡ Site en bêta
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
            Ce projet est en développement actif. Les données sont issues du scraping du site FFBB
            et peuvent parfois être incomplètes ou légèrement décalées. Les probabilités sont des
            estimations statistiques — elles ne prédisent pas l'avenir.{" "}
            <span style={{ color: "rgba(255,255,255,0.85)" }}>
              N'hésitez pas à signaler tout bug ou comportement inattendu.
            </span>
          </p>
        </section>

        {/* Contribute */}
        <section
          className="rounded-xl p-6"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--foreground)" }}>
            💡 Proposer une fonctionnalité
          </h2>
          <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--muted)" }}>
            Ce projet existe pour être utile. Si vous avez une idée — une stat manquante, un
            affichage à améliorer, un cas d'usage non couvert — partagez-la. Toutes les suggestions
            sont les bienvenues.
          </p>
          <a
            href="https://github.com/NathanPrats/ffbb-insights/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: "var(--foreground)", color: "var(--background)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
            </svg>
            Ouvrir une issue sur GitHub
          </a>
        </section>

        {/* Contact */}
        <section
          className="rounded-xl p-6"
          style={{ background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--foreground)" }}>
            👤 Contact
          </h2>
          <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
            Projet conçu et développé par <span style={{ color: "var(--foreground)" }}>Nathan Prats</span>.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:nathan.prats.pro@gmail.com"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              nathan.prats.pro@gmail.com
            </a>
            <a
              href="https://www.linkedin.com/in/nathan-prats/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              LinkedIn
            </a>
            <a
              href="https://github.com/NathanPrats/ffbb-insights"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--background)", color: "var(--foreground)", border: "1px solid var(--border)" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </a>
          </div>
        </section>

        {/* Back */}
        <div className="pt-2">
          <Link
            href="/"
            className="text-sm transition-opacity hover:opacity-80"
            style={{ color: "var(--muted)" }}
          >
            ← Retour à l'accueil
          </Link>
        </div>

      </div>
    </div>
  );
}
