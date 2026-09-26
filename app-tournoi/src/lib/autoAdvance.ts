import {
  getBracketState,
  groupIntoTables,
  isTableComplete,
  parseRoundId,
  planFinal,
  planFromPoules,
  planNextBracketRound,
} from "./bracket";
import { setConfig } from "./config";
import { createRounds, createSeats } from "./rounds";
import { loadTournamentData, targetForRound } from "./tournament";

/**
 * Runs after every result submission: cascades through every automatic step
 * that is now unlocked (poules -> Tableau A/B, next round of A or B, the
 * Grand Final, and closing the tournament) so players see their next table
 * appear without any admin action. Every round is generated using whatever
 * format settings (table size per stage, qualifiers per round, repechage...)
 * are currently configured — the admin can change them between rounds at any
 * time, it only affects rounds not yet generated.
 */
export async function autoAdvanceTournament() {
  for (let i = 0; i < 25; i++) {
    const {
      rounds,
      seats,
      config,
      tableTargets,
      repechageEnabled,
      pouleQualifiers,
      bRepechageCount,
      aQualifiersPerRound,
      bQualifiersPerRound,
      finalSeats,
    } = await loadTournamentData();
    const aBudget = repechageEnabled ? finalSeats - bRepechageCount : finalSeats;
    const tables = groupIntoTables(rounds, seats);

    const pouleTables = [...tables.values()].filter((t) => t.round.bracket === "POULE");
    const hasSplit = rounds.some((r) => r.bracket === "A" || r.bracket === "B");
    if (pouleTables.length > 0 && !hasSplit && pouleTables.every(isTableComplete)) {
      const { aRounds, aSeats, bRounds, bSeats } = planFromPoules(
        pouleTables,
        { a: tableTargets.quartA, b: tableTargets.quartB },
        repechageEnabled,
        pouleQualifiers
      );
      await createRounds([...aRounds, ...bRounds]);
      await createSeats([...aSeats, ...bSeats]);
      continue;
    }

    const aTables = [...tables.values()].filter((t) => t.round.bracket === "A");
    const bTables = [...tables.values()].filter((t) => t.round.bracket === "B");
    const aState = aTables.length ? getBracketState(aTables, aBudget, aQualifiersPerRound) : null;
    const bState =
      repechageEnabled && bTables.length
        ? getBracketState(bTables, bRepechageCount, bQualifiersPerRound)
        : null;

    if (aState?.status === "ready-to-advance") {
      const nextGen = parseRoundId(aState.tables[0].round.round_id).gen + 1;
      const { rounds: newR, seats: newS } = planNextBracketRound(
        "A",
        aState.tables,
        targetForRound(tableTargets, "A", nextGen),
        aQualifiersPerRound
      );
      await createRounds(newR);
      await createSeats(newS);
      continue;
    }
    if (bState?.status === "ready-to-advance") {
      const nextGen = parseRoundId(bState.tables[0].round.round_id).gen + 1;
      const { rounds: newR, seats: newS } = planNextBracketRound(
        "B",
        bState.tables,
        targetForRound(tableTargets, "B", nextGen),
        bQualifiersPerRound
      );
      await createRounds(newR);
      await createSeats(newS);
      continue;
    }

    const finalExists = rounds.some((r) => r.bracket === "FINAL");
    const bReady = repechageEnabled ? bState?.status === "done" : true;
    if (!finalExists && aState?.status === "done" && bReady) {
      const bChampionSeats =
        repechageEnabled && bState?.status === "done" ? bState.qualifiedSeats : [];
      const { rounds: newR, seats: newS } = planFinal(aState.qualifiedSeats, bChampionSeats);
      await createRounds(newR);
      await createSeats(newS);
      continue;
    }

    if (finalExists) {
      const finalTable = [...tables.values()].find((t) => t.round.bracket === "FINAL");
      if (finalTable && isTableComplete(finalTable) && config.status !== "finished") {
        await setConfig("status", "finished");
        continue;
      }
    }

    break;
  }
}
