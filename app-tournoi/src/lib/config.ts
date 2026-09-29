import { appendRows, readTab, updateRowCells } from "./sheets";
import type { TournamentStatus } from "./types";

const TAB = "Config";
const HEADERS = ["key", "value"];

export type ConfigMap = {
  tournament_code: string;
  status: TournamentStatus;
  table_target_size: string;
  repechage_enabled: "true" | "false";
  poule_qualifiers: string;
  b_repechage_count: string;
  table_size_poules: string;
  table_size_quart_a: string;
  table_size_demi_a: string;
  table_size_finale_a: string;
  table_size_quart_b: string;
  table_size_demi_b: string;
  table_size_finale_b: string;
  qualifiers_quart_a: string;
  qualifiers_demi_a: string;
  qualifiers_finale_a: string;
  qualifiers_quart_b: string;
  qualifiers_demi_b: string;
  qualifiers_finale_b: string;
};

export const STAGE_SIZE_KEYS = [
  "table_size_poules",
  "table_size_quart_a",
  "table_size_demi_a",
  "table_size_finale_a",
  "table_size_quart_b",
  "table_size_demi_b",
  "table_size_finale_b",
] as const;

export const QUALIFIER_KEYS = [
  "qualifiers_quart_a",
  "qualifiers_demi_a",
  "qualifiers_finale_a",
  "qualifiers_quart_b",
  "qualifiers_demi_b",
  "qualifiers_finale_b",
] as const;

export async function getConfig(): Promise<Partial<ConfigMap>> {
  const rows = await readTab<{ key: string; value: string }>(TAB);
  const map: Record<string, string> = {};
  rows.forEach((r) => {
    map[r.key] = r.value;
  });
  return map as Partial<ConfigMap>;
}

export async function setConfig(key: string, value: string) {
  const rows = await readTab<{ key: string; value: string }>(TAB);
  const existing = rows.find((r) => r.key === key);
  if (existing) {
    await updateRowCells(TAB, HEADERS, existing._row, { value });
  } else {
    await appendRows(TAB, HEADERS, [{ key, value }]);
  }
}
