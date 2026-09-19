import { NextResponse } from "next/server";
import { findPlayerById } from "@/lib/players";
import { getPlayerView } from "@/lib/playerView";
import { getPlayerSession } from "@/lib/session";
import { loadTournamentData } from "@/lib/tournament";

export async function GET() {
  const playerId = await getPlayerSession();
  if (!playerId) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }
  const player = await findPlayerById(playerId);
  if (!player) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }

  const { players, rounds, seats, finalSeats } = await loadTournamentData();
  const view = getPlayerView(playerId, players, rounds, seats, finalSeats);

  return NextResponse.json({ player, view });
}
