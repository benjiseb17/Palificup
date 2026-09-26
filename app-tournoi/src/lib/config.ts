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
  a_qualifiers_per_round: string;
  b_qualifiers_per_round: string;
};

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
