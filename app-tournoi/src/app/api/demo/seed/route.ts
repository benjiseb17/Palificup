import { NextRequest, NextResponse } from "next/server";
import { setConfig } from "@/lib/config";
import { clearTournament } from "@/lib/rounds";
import { isAdmin } from "@/lib/session";
import { appendRows, clearTabRows } from "@/lib/sheets";

const TEAMS = [
  "Les Dés d'Or",
  "Team Maskhouri",
  "Bluffeurs Unis",
  "Sans Pitié",
  "Escape Gang",
  "Les Poulpitos",
  "Ousmane Ballon d'Or",
  "Magic Girls",
  "Quai16",
  "Perudogs",
];

/**
 * Demo only: replaces the player list with fictitious players and clears any
 * tournament in progress, leaving it ready to be launched from the admin.
 * Format settings are kept. Body (optional): { count?: number, name?: string }.
 */
export async function POST(req: NextRequest) {
  if (process.env.DEMO_MODE !== "1") {
    return NextResponse.json({ error: "Mode démo désactivé." }, { status: 404 });
  }
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const customName = typeof body?.name === "string" ? body.name.trim() : "";
  const rawCount = Number(body?.count ?? 100);
  const count = Math.min(500, Math.max(4, Number.isFinite(rawCount) ? Math.round(rawCount) : 100));

  await clearTournament();
  await clearTabRows("Players");
  const players = Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    name: customName && i === 0 ? customName : `Joueur ${i + 1}`,
    team: TEAMS[i % TEAMS.length],
    seed: "",
  }));
  await appendRows("Players", ["id", "name", "team", "seed"], players);
  await setConfig("tournament_code", "DEMO");
  await setConfig("status", "setup");

  return NextResponse.json({ ok: true, playerCount: count, tournamentCode: "DEMO" });
}
