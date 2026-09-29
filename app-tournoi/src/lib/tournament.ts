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

export type QualifierTargets = {
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

function clampQualifiers(raw: string | undefined): number {
  const n = Number(raw || "1");
  return Math.min(Math.max(1, Number.isFinite(n) ? Math.round(n) : 1), MAX_TABLE_SIZE - 1);
}

function resolveQualifierTargets(config: Partial<ConfigMap>): QualifierTargets {
  return {
    quartA: clampQualifiers(config.qualifiers_quart_a),
    demiA: clampQualifiers(config.qualifiers_demi_a),
    finaleA: clampQualifiers(config.qualifiers_finale_a),
    quartB: clampQualifiers(config.qualifiers_quart_b),
    demiB: clampQualifiers(config.qualifiers_demi_b),
    finaleB: clampQualifiers(config.qualifiers_finale_b),
  };
}

/** Table size target for a given bracket round (gen 1 = Quart, 2 = Demi, 3+ = Finale). */
export function targetForRound(targets: TableTargets, bracket: "A" | "B", gen: number): number {
  if (bracket === "A") return gen <= 1 ? targets.quartA : gen === 2 ? targets.demiA : targets.finaleA;
  return gen <= 1 ? targets.quartB : gen === 2 ? targets.demiB : targets.finaleB;
}

/** Configured qualifiers-per-table for a given bracket round (gen 1 = Quart, 2 = Demi, 3+ = Finale). */
export function qualifiersForRound(
  targets: QualifierTargets,
  bracket: "A" | "B",
  gen: number
): number {
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
  const qualifierTargets = resolveQualifierTargets(config);
  const repechageEnabled = config.repechage_enabled !== "false";
  const pouleQualifiers = clampQualifiers(config.poule_qualifiers);

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
    qualifierTargets,
    repechageEnabled,
    pouleQualifiers,
    bRepechageCount,
  };
}
