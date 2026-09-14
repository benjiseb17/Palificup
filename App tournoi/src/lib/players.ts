import { readTab } from "./sheets";
import type { Player } from "./types";

const TAB = "Players";

export async function getPlayers() {
  return readTab<Player>(TAB);
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
