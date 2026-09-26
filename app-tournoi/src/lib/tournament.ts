import { MAX_TABLE_SIZE, clampTableTarget } from "./bracket";
import { getConfig, type ConfigMap } from "./config";
import { getPlayers } from "./players";
import { getRounds, getSeats } from "./rounds";

export type TableTargets = {
  poules: number;
  quartA: number;
  demiA: number;
  finaleA: number;
  quartB: number;
  demiB: number;
  finaleB: number;
};

function resolveTableTargets(config: Partial<ConfigMap>): TableTargets {
  const fallback = config.table_target_size || String(MAX_TABLE_SIZE);
  const pick = (raw: string | undefined) => clampTableTarget(Number(raw || fallback));
  return {
    poules: pick(config.table_size_poules),
    quartA: pick(config.table_size_quart_a),
    demiA: pick(config.table_size_demi_a),
    finaleA: pick(config.table_size_finale_a),
    quartB: pick(config.table_size_quart_b),
    demiB: pick(config.table_size_demi_b),
    finaleB: pick(config.table_size_finale_b),
  };
}

/** Table size target for a given bracket round (gen 1 = Quart, 2 = Demi, 3+ = Finale). */
export function targetForRound(targets: TableTargets, bracket: "A" | "B", gen: number): number {
  if (bracket === "A") return gen <= 1 ? targets.quartA : gen === 2 ? targets.demiA : targets.finaleA;
  return gen <= 1 ? targets.quartB : gen === 2 ? targets.demiB : targets.finaleB;
}

export async function loadTournamentData() {
  const [players, rounds, seats, config] = await Promise.all([
    getPlayers(),
    getRounds(),
    getSeats(),
    getConfig(),
  ]);
  const finalSeats = MAX_TABLE_SIZE;
  const tableTargets = resolveTableTargets(config);
  const repechageEnabled = config.repechage_enabled !== "false";

  const clampQualifiers = (raw: string | undefined) => {
    const n = Number(raw || "1");
    return Math.min(Math.max(1, Number.isFinite(n) ? Math.round(n) : 1), MAX_TABLE_SIZE - 1);
  };
  const pouleQualifiers = clampQualifiers(config.poule_qualifiers);
  const aQualifiersPerRound = clampQualifiers(config.a_qualifiers_per_round);
  const bQualifiersPerRound = clampQualifiers(config.b_qualifiers_per_round);

  const rawBRepechage = Number(config.b_repechage_count || "1");
  const bRepechageCount = Math.min(
    Math.max(1, Number.isFinite(rawBRepechage) ? Math.round(rawBRepechage) : 1),
    finalSeats - 1
  );

  return {
    players,
    rounds,
    seats,
    config,
    finalSeats,
    tableTargets,
    repechageEnabled,
    pouleQualifiers,
    bRepechageCount,
    aQualifiersPerRound,
    bQualifiersPerRound,
  };
}
