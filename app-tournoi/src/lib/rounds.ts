import { appendRows, clearTabRows, readTab, updateRowCells } from "./sheets";
import type { RoundRow, SeatRow } from "./types";

const ROUNDS_TAB = "Rounds";
const ROUNDS_HEADERS = ["round_id", "bracket", "stage", "table_number", "status"];
const SEATS_TAB = "Seats";
const SEATS_HEADERS = [
  "round_id",
  "player_id",
  "from_round_id",
  "from_rank",
  "finish_rank",
];

export const getRounds = () => readTab<RoundRow>(ROUNDS_TAB);
export const getSeats = () => readTab<SeatRow>(SEATS_TAB);

export async function createRounds(rows: RoundRow[]) {
  await appendRows(ROUNDS_TAB, ROUNDS_HEADERS, rows);
}

export async function createSeats(rows: SeatRow[]) {
  await appendRows(SEATS_TAB, SEATS_HEADERS, rows);
}

/** Removes every table and result, keeping players and format settings. */
export async function clearTournament() {
  await clearTabRows(ROUNDS_TAB);
  await clearTabRows(SEATS_TAB);
}

export async function setRoundStatus(
  row: { _row: number },
  status: "open" | "closed"
) {
  await updateRowCells(ROUNDS_TAB, ROUNDS_HEADERS, row._row, { status });
}

export async function setFinishRank(
  seat: { _row: number },
  finishRank: number
) {
  await updateRowCells(SEATS_TAB, SEATS_HEADERS, seat._row, {
    finish_rank: String(finishRank),
  });
}
