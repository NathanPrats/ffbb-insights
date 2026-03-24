import { NextResponse } from "next/server";

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

  return NextResponse.json(result, { status: 200 });
}
