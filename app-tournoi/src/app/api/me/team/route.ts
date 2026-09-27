import { NextRequest, NextResponse } from "next/server";
import { findPlayerById, listTeams, setPlayerTeam } from "@/lib/players";
import { getPlayerSession } from "@/lib/session";
import { loadTournamentData } from "@/lib/tournament";

/**
 * Lets a player join or switch to an EXISTING team, only until the end of the
 * Poules stage (once Tableau A/B exist, teams are locked for the rest of the
 * tournament). Creating a brand new team is not self-service on purpose —
 * players are told to see an admin, who can add it directly in the Sheet.
 */
export async function POST(req: NextRequest) {
  const playerId = await getPlayerSession();
  if (!playerId) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }
  const player = await findPlayerById(playerId);
  if (!player) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.team !== "string") {
    return NextResponse.json({ error: "Équipe requise." }, { status: 400 });
  }
  // Empty string is allowed on purpose: it lets a player leave their team.
  const team = body.team.trim();

  const { players, rounds } = await loadTournamentData();
  const locked = rounds.some((r) => r.bracket === "A" || r.bracket === "B");
  if (locked) {
    return NextResponse.json(
      { error: "Les équipes sont verrouillées : les Poules sont terminées." },
      { status: 409 }
    );
  }

  const existingTeams = listTeams(players);
  if (team !== "" && !existingTeams.includes(team)) {
    return NextResponse.json(
      {
        error:
          "Cette équipe n'existe pas encore. Pour en créer une, va voir les admins du tournoi.",
      },
      { status: 400 }
    );
  }

  await setPlayerTeam(player, team);
  return NextResponse.json({ ok: true, team });
}
