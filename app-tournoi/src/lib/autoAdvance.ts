import {
  getBracketState,
  groupIntoTables,
  isTableComplete,
  planFinal,
  planFromPoules,
  planNextBracketRound,
} from "./bracket";
import { setConfig } from "./config";
import { createRounds, createSeats } from "./rounds";
import { loadTournamentData } from "./tournament";

/**
 * Runs after every result submission: cascades through every automatic step
 * that is now unlocked (poules -> Tableau A/B, next round of A or B, the
 * Grand Final, and closing the tournament) so players see their next table
 * appear without any admin action. Every round is generated using whatever
 * format settings (table size, qualifiers per round, repechage...) are
 * currently configured — the admin can change them between rounds at any
 * time, it only affects rounds not yet generated.
 */
export async function autoAdvanceTournament() {
  for (let i = 0; i < 25; i++) {
    const {
      rounds,
      seats,
      config,
      tableSize: size,
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
        size,
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
      const { rounds: newR, seats: newS } = planNextBracketRound(
        "A",
        aState.tables,
        size,
        aQualifiersPerRound
      );
      await createRounds(newR);
      await createSeats(newS);
      continue;
    }
    if (bState?.status === "ready-to-advance") {
      const { rounds: newR, seats: newS } = planNextBracketRound(
        "B",
        bState.tables,
        size,
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
