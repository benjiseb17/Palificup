import { parseRoundId, rankedSeats, type RRow, type SRow, groupIntoTables } from "./bracket";
import type { Player } from "./types";

const A_LADDER_FROM_END = [50, 30]; // distance 0 (cutoff-round loss), 1 (round before)
const B_LADDER_FROM_END = [50, 40, 10]; // distance 0 (Finale B loss), 1, 2
export const FLOOR_POINTS = 10;
const FLOOR = FLOOR_POINTS;

function nonFinalPoints(bracket: "A" | "B", distanceFromEnd: number): number {
  const ladder = bracket === "A" ? A_LADDER_FROM_END : B_LADDER_FROM_END;
  return ladder[distanceFromEnd] ?? FLOOR;
}

export function pointsForEliminationAt(
  bracket: "A" | "B",
  gen: number,
  rounds: RRow[]
): number {
  let maxGen = 0;
  rounds.forEach((r) => {
    const p = parseRoundId(r.round_id);
    if (p.bracket === bracket) maxGen = Math.max(maxGen, p.gen);
  });
  return nonFinalPoints(bracket, maxGen - gen);
}

export type ClassementEntry = {
  player: Player;
  points: number;
  stage: string;
  rank: number;
};

export function computeClassement(
  players: Player[],
  rounds: RRow[],
  seats: SRow[],
  repechageEnabled: boolean
): ClassementEntry[] {
  const tables = groupIntoTables(rounds, seats);
  const finalTable = [...tables.values()].find(
    (t) => t.round.bracket === "FINAL"
  );

  const maxGenByBracket: Record<"A" | "B", number> = { A: 0, B: 0 };
  for (const t of tables.values()) {
    const p = parseRoundId(t.round.round_id);
    if (p.bracket === "A" || p.bracket === "B") {
      maxGenByBracket[p.bracket] = Math.max(maxGenByBracket[p.bracket], p.gen);
    }
  }

  const results: { playerId: string; points: number; stage: string }[] = [];

  if (finalTable && finalTable.seats.every((s) => s.finish_rank !== "")) {
    const ranked = rankedSeats(finalTable);
    ranked.forEach((seat) => {
      const cameFromB = seat.from_round_id.startsWith("B");
      const won = seat.finish_rank === "1";
      if (cameFromB) {
        results.push({
          playerId: seat.player_id,
          points: won ? 170 : 90,
          stage: won ? "Vainqueur (repêchage)" : "Finaliste (repêchage)",
        });
      } else {
        results.push({
          playerId: seat.player_id,
          points: won ? 150 : 70,
          stage: won ? "Vainqueur" : "Finaliste",
        });
      }
    });
  }

  const finalPlayerIds = new Set(results.map((r) => r.playerId));

  if (!repechageEnabled) {
    for (const t of tables.values()) {
      if (t.round.bracket !== "POULE") continue;
      if (!t.seats.every((s) => s.finish_rank !== "")) continue;
      rankedSeats(t).forEach((seat, idx) => {
        if (idx === 0) return; // poule winner advances to Tableau A, scored elsewhere
        results.push({ playerId: seat.player_id, points: FLOOR, stage: "Poules" });
      });
    }
  }

  for (const t of tables.values()) {
    const parsed = parseRoundId(t.round.round_id);
    if (parsed.bracket !== "A" && parsed.bracket !== "B") continue;
    const bracket = parsed.bracket;
    if (!t.seats.every((s) => s.finish_rank !== "")) continue;
    const ranked = rankedSeats(t);
    const distanceFromEnd = maxGenByBracket[bracket] - parsed.gen;
    ranked.forEach((seat, idx) => {
      if (finalPlayerIds.has(seat.player_id)) return; // already scored via the Grand Final
      const rank = idx + 1;
      const advances = rank === 1;
      // Advancing players are never "final" at this table: either a later table/round
      // already exists for them (scored there or via the Grand Final block above), or
      // the admin hasn't generated it yet — either way they aren't eliminated here.
      if (advances) return;
      results.push({
        playerId: seat.player_id,
        points: nonFinalPoints(bracket, distanceFromEnd),
        stage: t.round.stage,
      });
    });
  }

  const byPlayer = new Map<string, { points: number; stage: string }>();
  results.forEach((r) => {
    const existing = byPlayer.get(r.playerId);
    if (!existing || r.points > existing.points) {
      byPlayer.set(r.playerId, { points: r.points, stage: r.stage });
    }
  });

  const entries = players
    .filter((p) => byPlayer.has(p.id))
    .map((p) => ({ player: p, ...byPlayer.get(p.id)! }));

  entries.sort((a, b) => b.points - a.points);

  let rank = 0;
  let lastPoints: number | null = null;
  const withRank: ClassementEntry[] = entries.map((e, idx) => {
    if (e.points !== lastPoints) {
      rank = idx + 1;
      lastPoints = e.points;
    }
    return { ...e, rank };
  });

  return withRank;
}

export type TeamClassementEntry = {
  team: string;
  points: number;
  rank: number;
};

export function computeTeamClassement(
  individual: ClassementEntry[]
): TeamClassementEntry[] {
  const byTeam = new Map<string, number>();
  individual.forEach((e) => {
    const team = e.player.team?.trim();
    if (!team) return;
    byTeam.set(team, (byTeam.get(team) ?? 0) + e.points);
  });
  const entries = [...byTeam.entries()]
    .map(([team, points]) => ({ team, points }))
    .sort((a, b) => b.points - a.points);

  let rank = 0;
  let lastPoints: number | null = null;
  return entries.map((e, idx) => {
    if (e.points !== lastPoints) {
      rank = idx + 1;
      lastPoints = e.points;
    }
    return { ...e, rank };
  });
}
