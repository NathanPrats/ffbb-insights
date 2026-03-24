import { NextResponse } from "next/server";
import { fetchStandings, fetchCompetitions } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "(non défini)";

  const result: Record<string, unknown> = {
    NEXT_PUBLIC_API_BASE: apiBase,
    NODE_ENV: process.env.NODE_ENV,
  };

  // Test fetch vers /api/competitions
  const url = `${apiBase === "(non défini)" ? "http://localhost:8080" : apiBase}/api/competitions`;
  result.fetch_url = url;

  const start = Date.now();
  try {
    const res = await fetch(url, { cache: "no-store" });
    result.fetch_status = res.status;
    result.fetch_ok = res.ok;
    result.fetch_ms = Date.now() - start;
    if (res.ok) {
      result.fetch_body = await res.json();
    } else {
      result.fetch_body = await res.text();
    }
  } catch (err) {
    result.fetch_error = String(err);
    result.fetch_ms = Date.now() - start;
  }

  // Test fetch vers /api/competitions/idf-dm3/standings
  const standingsUrl = `${apiBase === "(non défini)" ? "http://localhost:8080" : apiBase}/api/competitions/idf-dm3/standings`;
  result.standings_url = standingsUrl;

  const start2 = Date.now();
  try {
    const res2 = await fetch(standingsUrl, { cache: "no-store" });
    result.standings_status = res2.status;
    result.standings_ok = res2.ok;
    result.standings_ms = Date.now() - start2;
    if (!res2.ok) result.standings_error_body = await res2.text();
  } catch (err) {
    result.standings_error = String(err);
    result.standings_ms = Date.now() - start2;
  }

  // Test via lib/api.ts (même code que les server components)
  const start3 = Date.now();
  try {
    const comps = await fetchCompetitions();
    result.lib_competitions_count = comps.length;
    result.lib_competitions_ms = Date.now() - start3;
  } catch (err) {
    result.lib_competitions_error = String(err);
    result.lib_competitions_ms = Date.now() - start3;
  }

  const start4 = Date.now();
  try {
    const s = await fetchStandings("idf-dm3");
    result.lib_standings_teams = s.classement?.length ?? "classement undefined";
    result.lib_standings_ms = Date.now() - start4;
  } catch (err) {
    result.lib_standings_error = String(err);
    result.lib_standings_ms = Date.now() - start4;
  }

  return NextResponse.json(result, { status: 200 });
}
