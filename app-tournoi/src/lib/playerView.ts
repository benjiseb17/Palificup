import {
  getBracketState,
  groupIntoTables,
  parseRoundId,
  rankedSeats,
  type RRow,
  type SRow,
} from "./bracket";
import { FLOOR_POINTS, pointsForEliminationAt } from "./scoring";
import type { Player } from "./types";

function depthOf(roundId: string): number {
  const p = parseRoundId(roundId);
  if (p.bracket === "POULE") return 0;
  if (p.bracket === "FINAL") return 9999;
  return p.gen;
}

export type PlayerView =
  | { status: "not-started" }
  | {
      status: "playing" | "waiting-table-results";
      round: RRow;
      stage: string;
      seatmates: { player: Player; finishRank: string | null }[];
      canSubmit: boolean;
    }
  | {
      status: "waiting-next-round";
      lastStage: string;
    }
  | {
      status: "eliminated";
      lastStage: string;
      points: number;
    }
  | {
      status: "tournament-done";
      finalRank: string | null;
      points: number;
    };

export function getPlayerView(
  playerId: string,
  players: Player[],
  rounds: RRow[],
  seats: SRow[],
  finalSeats: number,
  repechageEnabled: boolean,
  pouleQualifiers: number,
  bRepechageCount: number
): PlayerView {
  const bySeatId = new Map(players.map((p) => [p.id, p]));
  const mySeats = seats.filter((s) => s.player_id === playerId);
  if (mySeats.length === 0) return { status: "not-started" };

  const latest = mySeats.reduce((best, s) =>
    depthOf(s.round_id) > depthOf(best.round_id) ? s : best
  );
  const round = rounds.find((r) => r.round_id === latest.round_id);
  if (!round) return { status: "not-started" };

  const tables = groupIntoTables(rounds, seats);
  const table = tables.get(latest.round_id)!;

  if (latest.finish_rank === "") {
    const seatmates = table.seats.map((s) => ({
      player: bySeatId.get(s.player_id)!,
      finishRank: s.finish_rank || null,
    }));
    return {
      status: "playing",
      round,
      stage: round.stage,
      seatmates,
      canSubmit: true,
    };
  }

  if (round.bracket === "FINAL") {
    return {
      status: "tournament-done",
      finalRank: latest.finish_rank,
      points: pointsForFinalRank(latest.finish_rank, latest.from_round_id),
    };
  }

  const parsed = parseRoundId(round.round_id);
  const ranked = rankedSeats(table);
  const myRank = ranked.findIndex((s) => s.player_id === playerId) + 1;

  if (parsed.bracket === "POULE") {
    // Winners always get a Tableau A seat next; non-winners do too when repechage
    // is on. Either way, this poule seat isn't terminal yet — just show the result
    // while waiting for the next round to be generated (usually near-instant).
    if (myRank <= pouleQualifiers || repechageEnabled) {
      const seatmates = table.seats.map((s) => ({
        player: bySeatId.get(s.player_id)!,
        finishRank: s.finish_rank || null,
      }));
      return {
        status: "waiting-table-results",
        round,
        stage: round.stage,
        seatmates,
        canSubmit: false,
      };
    }
    // Repechage disabled and this player didn't win their poule: game over.
    return { status: "eliminated", lastStage: round.stage, points: FLOOR_POINTS };
  }

  const bracket = parsed.bracket as "A" | "B";
  const genTables = [...tables.values()].filter(
    (t) => parseRoundId(t.round.round_id).gen === parsed.gen &&
      parseRoundId(t.round.round_id).bracket === bracket
  );
  const budget =
    bracket === "A"
      ? repechageEnabled
        ? finalSeats - bRepechageCount
        : finalSeats
      : bRepechageCount;
  const state = getBracketState(genTables, budget);

  if (state.status === "ready-to-advance") {
    if (myRank === 1) return { status: "waiting-next-round", lastStage: round.stage };
    return {
      status: "eliminated",
      lastStage: round.stage,
      points: pointsForEliminationAt(bracket, parsed.gen, rounds),
    };
  }

  if (state.status === "done") {
    if (myRank === 1) {
      return { status: "waiting-next-round", lastStage: round.stage };
    }
    return {
      status: "eliminated",
      lastStage: round.stage,
      points: pointsForEliminationAt(bracket, parsed.gen, rounds),
    };
  }

  // still in-progress (shouldn't normally happen since latest seat is complete)
  const seatmates = table.seats.map((s) => ({
    player: bySeatId.get(s.player_id)!,
    finishRank: s.finish_rank || null,
  }));
  return {
    status: "waiting-table-results",
    round,
    stage: round.stage,
    seatmates,
    canSubmit: false,
  };
}

function pointsForFinalRank(finishRank: string, fromRoundId: string): number {
  const cameFromB = fromRoundId.startsWith("B");
  const won = finishRank === "1";
  if (cameFromB) return won ? 170 : 90;
  return won ? 150 : 70;
}
