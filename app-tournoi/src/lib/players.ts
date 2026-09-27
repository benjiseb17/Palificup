import { readTab, updateRowCells } from "./sheets";
import type { Player } from "./types";

const TAB = "Players";
const HEADERS = ["id", "name", "team", "seed"];

export async function getPlayers() {
  return readTab<Player>(TAB);
}

/** Every distinct, non-empty team name currently used by a player, sorted. */
export function listTeams(players: Player[]): string[] {
  const teams = new Set(players.map((p) => p.team.trim()).filter(Boolean));
  return [...teams].sort((a, b) => a.localeCompare(b, "fr"));
}

/**
 * Lets a player self-serve join/change to an EXISTING team (row must already be
 * loaded, e.g. via findPlayerById, so we have its `_row`). Creating a brand new
 * team is intentionally not self-service — players are told to ask an admin,
 * who can just type a new value directly in the Players sheet.
 */
export async function setPlayerTeam(row: { _row: number }, team: string) {
  await updateRowCells(TAB, HEADERS, row._row, { team });
}

export function normalizeName(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export async function findPlayerByName(name: string) {
  const players = await getPlayers();
  const target = normalizeName(name);
  return players.find((p) => normalizeName(p.name) === target);
}

export async function findPlayerById(id: string) {
  const players = await getPlayers();
  return players.find((p) => p.id === id);
}
