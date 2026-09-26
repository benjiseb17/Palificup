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
  return { players, rounds, seats, config, finalSeats, tableSize, repechageEnabled };
}
