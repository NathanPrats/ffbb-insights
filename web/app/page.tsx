import { fetchCompetitions } from "@/lib/api";
import HomeClient from "./HomeClient";

export default async function HomePage() {
  const competitions = await fetchCompetitions().catch(() => []);

  return <HomeClient competitions={competitions} />;
}
