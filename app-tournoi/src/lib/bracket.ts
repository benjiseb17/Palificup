import type { SheetRecord } from "./sheets";
import type { Player, RoundRow, SeatRow } from "./types";

export type RRow = SheetRecord<RoundRow>;
export type SRow = SheetRecord<SeatRow>;

export type TableState = { round: RRow; seats: SRow[] };

/** Règles fixes d'une table de Perudo, indépendantes de la taille cible choisie. */
export const MIN_TABLE_SIZE = 3;
export const MAX_TABLE_SIZE = 5;

/** Clamps a configured target size into the playable [MIN, MAX] range. */
export function clampTableTarget(target: number): number {
  const t = Number.isFinite(target) ? Math.round(target) : MAX_TABLE_SIZE;
  return Math.min(MAX_TABLE_SIZE, Math.max(MIN_TABLE_SIZE, t));
}

/**
 * Plans how many players go at each table for a group of `total` players,
 * aiming for `target` players per table (the minimum number of tables):
 * - Fill as many tables as possible with exactly `target` players.
 * - If the leftover is 3 or more, it becomes its own (smaller) table.
 * - If the leftover is only 1 or 2 (too few for a table), spread them one
 *   by one onto the other tables — never beyond MAX_TABLE_SIZE.
 * - If every table is already full at MAX_TABLE_SIZE, borrow players from
 *   the last table to make the leftover a playable table of 3.
 */
export function planTableSizes(total: number, target: number): number[] {
  if (total <= 0) return [];
  const t = clampTableTarget(target);
  const full = Math.floor(total / t);
  const remainder = total - full * t;
  const sizes = Array<number>(full).fill(t);
  if (remainder === 0) return sizes;
  if (remainder >= MIN_TABLE_SIZE || full === 0) return [...sizes, remainder];

  let toPlace = remainder;
  for (let i = 0; toPlace > 0 && sizes.some((s) => s < MAX_TABLE_SIZE); i++) {
    const idx = i % sizes.length;
    if (sizes[idx] < MAX_TABLE_SIZE) {
      sizes[idx] += 1;
      toPlace -= 1;
    }
  }
  if (toPlace === 0) return sizes;

  const borrow = MIN_TABLE_SIZE - toPlace;
  const last = sizes.length - 1;
  if (sizes[last] - borrow >= MIN_TABLE_SIZE) {
    sizes[last] -= borrow;
    return [...sizes, MIN_TABLE_SIZE];
  }
  return [...sizes, toPlace];
}

/** Deals entries round-robin into tables of the given capacities. */
function dealIntoTables<T>(ordered: T[], sizes: number[]): T[][] {
  const tables: T[][] = sizes.map(() => []);
  let cursor = 0;
  for (const item of ordered) {
    let tries = 0;
    while (tables[cursor % tables.length].length >= sizes[cursor % tables.length] && tries < tables.length) {
      cursor++;
      tries++;
    }
    tables[cursor % tables.length].push(item);
    cursor++;
  }
  return tables;
}

export function groupIntoTables(
  rounds: RRow[],
  seats: SRow[]
): Map<string, TableState> {
  const map = new Map<string, TableState>();
  rounds.forEach((r) => map.set(r.round_id, { round: r, seats: [] }));
  seats.forEach((s) => {
    const t = map.get(s.round_id);
    if (t) t.seats.push(s);
  });
  return map;
}

export function isTableComplete(t: TableState) {
  return t.seats.length > 0 && t.seats.every((s) => s.finish_rank !== "");
}

export function rankedSeats(t: TableState): SRow[] {
  return [...t.seats].sort(
    (a, b) => Number(a.finish_rank) - Number(b.finish_rank)
  );
}

export function parseRoundId(id: string): {
  bracket: "POULE" | "A" | "B" | "FINAL";
  gen: number;
  table: number;
} {
  if (id.startsWith("POULE-"))
    return { bracket: "POULE", gen: 0, table: Number(id.split("-")[1]) };
  if (id.startsWith("FINAL")) return { bracket: "FINAL", gen: 0, table: 1 };
  const m = id.match(/^([AB])(\d+)-(\d+)$/);
  if (!m) throw new Error(`round_id invalide: ${id}`);
  return { bracket: m[1] as "A" | "B", gen: Number(m[2]), table: Number(m[3]) };
}

/**
 * Nomenclature simplifiée et fixe par tableau : 1er tour après les Poules =
 * Quart, 2e = Demi, 3e = Finale (du tableau), peu importe le nombre de
 * tables à ce tour. Chaque étape précise le tableau (A ou B) pour éviter la
 * confusion avec la Grande Finale (fusion des deux tableaux).
 */
export function stageLabel(bracket: "POULE" | "A" | "B" | "FINAL", gen: number): string {
  if (bracket === "POULE") return "Poules";
  if (bracket === "FINAL") return "Grande Finale";
  const names = ["Quart", "Demi", "Finale"];
  const stageName = names[gen - 1] ?? `Tour ${gen}`;
  return `${stageName} ${bracket}`;
}

/** Groups entries into tables aiming for `target` seats, spreading same-origin players apart. */
function distributeIntoTables(
  entries: { playerId: string; originRoundId: string }[],
  target: number
): string[][] {
  if (entries.length === 0) return [];
  const sorted = [...entries].sort((a, b) =>
    a.originRoundId.localeCompare(b.originRoundId)
  );
  const sizes = planTableSizes(sorted.length, target);
  return dealIntoTables(sorted, sizes).map((table) => table.map((e) => e.playerId));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function planPoules(
  players: Player[],
  target: number
): {
  rounds: RoundRow[];
  seats: SeatRow[];
} {
  const withSeed = players.map((p) => ({
    ...p,
    seedNum: p.seed && !Number.isNaN(Number(p.seed)) ? Number(p.seed) : null,
  }));
  const seeded = withSeed
    .filter((p) => p.seedNum !== null)
    .sort((a, b) => (a.seedNum as number) - (b.seedNum as number));
  const unseeded = shuffle(withSeed.filter((p) => p.seedNum === null));
  const ordered = [...seeded, ...unseeded];

  const tables = dealIntoTables(ordered, planTableSizes(ordered.length, target));

  const rounds: RoundRow[] = [];
  const seats: SeatRow[] = [];
  tables.forEach((tablePlayers, idx) => {
    const round_id = `POULE-${idx + 1}`;
    rounds.push({
      round_id,
      bracket: "POULE",
      stage: "Poules",
      table_number: String(idx + 1),
      status: "open",
    });
    tablePlayers.forEach((p) => {
      seats.push({
        round_id,
        player_id: p.id,
        from_round_id: "",
        from_rank: "",
        finish_rank: "",
      });
    });
  });
  return { rounds, seats };
}

export function planFromPoules(
  pouleTables: TableState[],
  targets: { a: number; b: number },
  repechageEnabled: boolean,
  pouleQualifiers: number
): {
  aRounds: RoundRow[];
  aSeats: SeatRow[];
  bRounds: RoundRow[];
  bSeats: SeatRow[];
} {
  const aEntries: { playerId: string; originRoundId: string; rank: string }[] = [];
  const bEntries: { playerId: string; originRoundId: string; rank: string }[] = [];

  pouleTables.forEach((t) => {
    rankedSeats(t).forEach((s, idx) => {
      const rank = idx + 1;
      const entry = {
        playerId: s.player_id,
        originRoundId: t.round.round_id,
        rank: String(rank),
      };
      if (rank <= pouleQualifiers) aEntries.push(entry);
      else if (repechageEnabled) bEntries.push(entry);
      // repechage disabled: poule non-qualifiers simply stay eliminated at their poule seat.
    });
  });

  const aTables = distributeIntoTables(aEntries, targets.a);
  const bTables = repechageEnabled ? distributeIntoTables(bEntries, targets.b) : [];

  const aRounds: RoundRow[] = [];
  const aSeats: SeatRow[] = [];
  aTables.forEach((playerIds, idx) => {
    const round_id = `A1-${idx + 1}`;
    aRounds.push({
      round_id,
      bracket: "A",
      stage: stageLabel("A", 1),
      table_number: String(idx + 1),
      status: "open",
    });
    playerIds.forEach((pid) => {
      const src = aEntries.find((e) => e.playerId === pid)!;
      aSeats.push({
        round_id,
        player_id: pid,
        from_round_id: src.originRoundId,
        from_rank: src.rank,
        finish_rank: "",
      });
    });
  });

  const bRounds: RoundRow[] = [];
  const bSeats: SeatRow[] = [];
  bTables.forEach((playerIds, idx) => {
    const round_id = `B1-${idx + 1}`;
    bRounds.push({
      round_id,
      bracket: "B",
      stage: stageLabel("B", 1),
      table_number: String(idx + 1),
      status: "open",
    });
    playerIds.forEach((pid) => {
      const src = bEntries.find((e) => e.playerId === pid)!;
      bSeats.push({
        round_id,
        player_id: pid,
        from_round_id: src.originRoundId,
        from_rank: src.rank,
        finish_rank: "",
      });
    });
  });

  return { aRounds, aSeats, bRounds, bSeats };
}

export type BracketState =
  | { status: "in-progress"; tables: TableState[] }
  | { status: "ready-to-advance"; tables: TableState[] }
  | { status: "done"; tables: TableState[]; qualifiedSeats: SRow[] };

/**
 * Format officiel Palificup : par défaut, à chaque table, seul le vainqueur
 * (rang 1) continue — mais l'admin peut faire monter plus d'un joueur par
 * table à un tour donné (qualifiersPerRound). Chaque tableau s'arrête dès que
 * le nombre de qualifiés restants tient dans son budget de sièges pour la
 * Grande Finale : ils y entrent alors directement (le Tableau A vise le
 * budget "places directes", le Tableau B vise le nombre de repêchés voulu).
 */
export function getBracketState(
  tables: TableState[],
  budget: number,
  qualifiersPerRound: number
): BracketState {
  if (tables.length === 0) return { status: "in-progress", tables: [] };
  const maxGen = Math.max(...tables.map((t) => parseRoundId(t.round.round_id).gen));
  const current = tables.filter(
    (t) => parseRoundId(t.round.round_id).gen === maxGen
  );
  if (!current.every(isTableComplete)) {
    return { status: "in-progress", tables: current };
  }
  const qualifiedSeats = current.flatMap((t) =>
    rankedSeats(t).slice(0, qualifiersPerRound)
  );
  if (qualifiedSeats.length <= budget) {
    return { status: "done", tables: current, qualifiedSeats };
  }
  return { status: "ready-to-advance", tables: current };
}

export function planNextBracketRound(
  bracket: "A" | "B",
  currentTables: TableState[],
  target: number,
  qualifiersPerRound: number
): { rounds: RoundRow[]; seats: SeatRow[] } {
  const gen = Math.max(
    ...currentTables.map((t) => parseRoundId(t.round.round_id).gen)
  );
  const nextGen = gen + 1;

  const entries: { playerId: string; originRoundId: string; rank: string }[] = [];
  currentTables.forEach((t) => {
    rankedSeats(t)
      .slice(0, qualifiersPerRound)
      .forEach((s, idx) => {
        entries.push({
          playerId: s.player_id,
          originRoundId: t.round.round_id,
          rank: String(idx + 1),
        });
      });
  });

  const newTables = distributeIntoTables(entries, target);
  const rounds: RoundRow[] = [];
  const seats: SeatRow[] = [];
  newTables.forEach((playerIds, idx) => {
    const round_id = `${bracket}${nextGen}-${idx + 1}`;
    rounds.push({
      round_id,
      bracket,
      stage: stageLabel(bracket, nextGen),
      table_number: String(idx + 1),
      status: "open",
    });
    playerIds.forEach((pid) => {
      const src = entries.find((e) => e.playerId === pid)!;
      seats.push({
        round_id,
        player_id: pid,
        from_round_id: src.originRoundId,
        from_rank: src.rank,
        finish_rank: "",
      });
    });
  });
  return { rounds, seats };
}

export function planFinal(
  aChampionSeats: SRow[],
  bChampionSeats: SRow[]
): { rounds: RoundRow[]; seats: SeatRow[] } {
  const round_id = "FINAL-1";
  const rounds: RoundRow[] = [
    {
      round_id,
      bracket: "FINAL",
      stage: "Grande Finale",
      table_number: "1",
      status: "open",
    },
  ];
  const finalists = [...aChampionSeats, ...bChampionSeats];
  const seats: SeatRow[] = finalists.map((s) => ({
    round_id,
    player_id: s.player_id,
    from_round_id: s.round_id,
    from_rank: s.finish_rank,
    finish_rank: "",
  }));
  return { rounds, seats };
}
