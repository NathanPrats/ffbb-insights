import { fetchCompetitions } from "@/lib/api";
import HomeClient from "./HomeClient";

export default async function HomePage() {
  const competitions = await fetchCompetitions().catch(() => []);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-1">Championnats</h1>
      <p className="text-sm mb-8" style={{ color: "var(--muted)" }}>
        Colle l&apos;URL d&apos;une page classement FFBB pour l&apos;analyser.
      </p>

      <HomeClient competitions={competitions} />
    </div>
  );
}
