import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { getPlayers } from "@/lib/players";

/**
 * Public (no session) but gated by the tournament code — same information a
 * player already needs to log in. Powers the name autocomplete on the login
 * screen so players pick their name from the real roster instead of
 * free-typing it (typos, or worse, accidentally typing someone else's name
 * and landing in their session).
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")?.trim() ?? "";
  if (!code) {
    return NextResponse.json({ error: "Code du tournoi requis." }, { status: 400 });
  }

  const config = await getConfig();
  if (!config.tournament_code || code !== config.tournament_code) {
    return NextResponse.json({ error: "Code du tournoi incorrect." }, { status: 401 });
  }

  const players = await getPlayers();
  return NextResponse.json({
    players: players.map((p) => ({ name: p.name, team: p.team })),
  });
}
