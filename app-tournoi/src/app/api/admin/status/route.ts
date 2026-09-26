import { NextResponse } from "next/server";
import {
  getBracketState,
  groupIntoTables,
  isTableComplete,
  parseRoundId,
  rankedSeats,
  type TableState,
} from "@/lib/bracket";
import { isAdmin } from "@/lib/session";
import { loadTournamentData } from "@/lib/tournament";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const {
    players,
    rounds,
    seats,
    config,
    finalSeats,
    repechageEnabled,
    bRepechageCount,
    aQualifiersPerRound,
    bQualifiersPerRound,
    tableTargets,
  } = await loadTournamentData();
  const nameById = new Map(players.map((p) => [p.id, p.name]));
  const aBudget = repechageEnabled ? finalSeats - bRepechageCount : finalSeats;
  const tables = groupIntoTables(rounds, seats);

  const pouleTables = [...tables.values()].filter(
    (t) => t.round.bracket === "POULE"
  );
  const aTables = [...tables.values()].filter((t) => t.round.bracket === "A");
  const bTables = [...tables.values()].filter((t) => t.round.bracket === "B");
  const finalTable = [...tables.values()].find((t) => t.round.bracket === "FINAL");

  const pouleDone = pouleTables.length > 0 && pouleTables.every(isTableComplete);
  const aState =
    aTables.length > 0 ? getBracketState(aTables, aBudget, aQualifiersPerRound) : null;
  const bState =
    repechageEnabled && bTables.length > 0
      ? getBracketState(bTables, bRepechageCount, bQualifiersPerRound)
      : null;

  const summarize = (list: TableState[]) =>
    list
      .map((t) => ({
        round_id: t.round.round_id,
        stage: t.round.stage,
        table_number: Number(t.round.table_number) || 0,
        gen: parseRoundId(t.round.round_id).gen,
        seatCount: t.seats.length,
        complete: isTableComplete(t),
        seats: rankedSeats(t).map((s) => ({
          player_id: s.player_id,
          name: nameById.get(s.player_id) ?? "?",
          finish_rank: s.finish_rank,
        })),
      }))
      .sort((a, b) => a.gen - b.gen || a.table_number - b.table_number);

  return NextResponse.json({
    config,
    playerCount: players.length,
    tournamentStarted: rounds.length > 0,
    demoMode: process.env.DEMO_MODE === "1",
    repechageEnabled,
    tableTargets,
    poules: { tables: summarize(pouleTables), done: pouleDone },
    bracketA: aState
      ? { status: aState.status, tables: summarize(aTables) }
      : { status: pouleDone ? "not-generated" : "waiting-poules", tables: [] },
    bracketB: !repechageEnabled
      ? { status: "disabled", tables: [] }
      : bState
        ? { status: bState.status, tables: summarize(bTables) }
        : { status: pouleDone ? "not-generated" : "waiting-poules", tables: [] },
    final: finalTable
      ? {
          exists: true,
          complete: isTableComplete(finalTable),
          seatCount: finalTable.seats.length,
        }
      : { exists: false },
  });
}
