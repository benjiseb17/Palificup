import { tableSizeConfig } from "./bracket";
import { getConfig } from "./config";
import { getPlayers } from "./players";
import { getRounds, getSeats } from "./rounds";

export async function loadTournamentData() {
  const [players, rounds, seats, config] = await Promise.all([
    getPlayers(),
    getRounds(),
    getSeats(),
    getConfig(),
  ]);
  const target = Number(config.table_target_size || "5");
  const finalSeats = target;
  const tableSize = tableSizeConfig(target);
  const repechageEnabled = config.repechage_enabled !== "false";

  const rawQualifiers = Number(config.poule_qualifiers || "1");
  const pouleQualifiers = Math.min(
    Math.max(1, Number.isFinite(rawQualifiers) ? Math.round(rawQualifiers) : 1),
    Math.max(1, tableSize.min - 1)
  );

  const rawBRepechage = Number(config.b_repechage_count || "1");
  const bRepechageCount = Math.min(
    Math.max(1, Number.isFinite(rawBRepechage) ? Math.round(rawBRepechage) : 1),
    Math.max(1, finalSeats - 1)
  );

  return {
    players,
    rounds,
    seats,
    config,
    finalSeats,
    tableSize,
    repechageEnabled,
    pouleQualifiers,
    bRepechageCount,
  };
}
