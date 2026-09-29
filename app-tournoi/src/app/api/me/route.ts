import { NextResponse } from "next/server";
import { findPlayerById, listTeams } from "@/lib/players";
import { getPlayerView } from "@/lib/playerView";
import { getPlayerSession } from "@/lib/session";
import { loadTournamentData } from "@/lib/tournament";

/** Team changes are self-service only through the end of the Poules stage. */
function teamsLocked(rounds: { bracket: string }[]) {
  return rounds.some((r) => r.bracket === "A" || r.bracket === "B");
}

export async function GET() {
  const playerId = await getPlayerSession();
  if (!playerId) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }
  const player = await findPlayerById(playerId);
  if (!player) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }

  const {
    players,
    rounds,
    seats,
    finalSeats,
    repechageEnabled,
    pouleQualifiers,
    bRepechageCount,
    qualifierTargets,
  } = await loadTournamentData();
  const view = getPlayerView(
    playerId,
    players,
    rounds,
    seats,
    finalSeats,
    repechageEnabled,
    pouleQualifiers,
    bRepechageCount,
    qualifierTargets
  );

  return NextResponse.json({
    player,
    view,
    teamChangeLocked: teamsLocked(rounds),
    availableTeams: listTeams(players),
  });
}
