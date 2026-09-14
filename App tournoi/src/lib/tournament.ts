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
  const finalSeats = Number(config.table_target_size || "5");
  return { players, rounds, seats, config, finalSeats };
}
