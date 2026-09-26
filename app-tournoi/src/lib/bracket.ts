import type { SheetRecord } from "./sheets";
import type { Player, RoundRow, SeatRow } from "./types";

export type RRow = SheetRecord<RoundRow>;
export type SRow = SheetRecord<SeatRow>;

export type TableState = { round: RRow; seats: SRow[] };

export type TableSizeConfig = { min: number; max: number };

/** Derives a min/max table size range from a single "target" number (e.g. 5 -> 4-5 seats). */
export function tableSizeConfig(target: number): TableSizeConfig {
  const t = Number.isFinite(target) && target >= 3 ? Math.round(target) : 5;
  return { min: t - 1, max: t };
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

export function stageLabel(
  bracket: "POULE" | "A" | "B" | "FINAL",
  tableCountThisRound: number
) {
  if (bracket === "POULE") return "Poules";
  if (bracket === "FINAL") return "Grande Finale";
  const suffix = bracket === "B" ? " (repêchage)" : "";
  if (tableCountThisRound === 1) return bracket === "B" ? "Finale B" : "Finale A";
  if (tableCountThisRound <= 2) return `Demies${suffix}`;
  if (tableCountThisRound <= 4) return `Quarts${suffix}`;
  if (tableCountThisRound <= 8) return `Huitièmes${suffix}`;
  return `Tour${suffix}`;
}

/**
 * Picks how many size.min-size.max tables a group of `total` people should
 * split into. When `total` doesn't divide cleanly into that range (e.g. 6
 * people with 4-5 seat tables — no split keeps every table in range), it
 * picks whichever extreme (fewer/larger vs more/smaller tables) deviates
 * least from the range, preferring fewer tables on a tie.
 */
function computeTableCount(total: number, size: TableSizeConfig): number {
  if (total <= 0) return 0;
  const byMax = Math.max(1, Math.ceil(total / size.max)); // keeps every table <= max
  const byMin = Math.max(1, Math.floor(total / size.min)); // keeps every table >= min
  if (byMax <= byMin) {
    const mid = (size.min + size.max) / 2;
    let best = byMax;
    let bestDiff = Infinity;
    for (let tc = byMax; tc <= byMin; tc++) {
      const diff = Math.abs(total / tc - mid);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = tc;
      }
    }
    return best;
  }
  // Gap: no count keeps every table within [min,max].
  const maxViolation = Math.max(0, size.min - total / byMax);
  const minViolation = Math.max(0, total / byMin - size.max);
  return minViolation <= maxViolation ? byMin : byMax;
}

/** Groups entries into size.min-size.max seat tables, spreading same-origin players apart. */
function distributeIntoTables(
  entries: { playerId: string; originRoundId: string }[],
  size: TableSizeConfig
): string[][] {
  const total = entries.length;
  if (total === 0) return [];
  const tableCount = computeTableCount(total, size);

  const sorted = [...entries].sort((a, b) =>
    a.originRoundId.localeCompare(b.originRoundId)
  );
  const tables: string[][] = Array.from({ length: tableCount }, () => []);
  sorted.forEach((e, i) => tables[i % tableCount].push(e.playerId));
  return tables;
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
  size: TableSizeConfig
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

  const total = ordered.length;
  const tableCount = computeTableCount(total, size);

  const tables: Player[][] = Array.from({ length: tableCount }, () => []);
  ordered.forEach((p, i) => tables[i % tableCount].push(p));

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
  size: TableSizeConfig,
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

  const aTables = distributeIntoTables(aEntries, size);
  const bTables = repechageEnabled ? distributeIntoTables(bEntries, size) : [];

  const aRounds: RoundRow[] = [];
  const aSeats: SeatRow[] = [];
  aTables.forEach((playerIds, idx) => {
    const round_id = `A1-${idx + 1}`;
    aRounds.push({
      round_id,
      bracket: "A",
      stage: stageLabel("A", aTables.length),
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
      stage: stageLabel("B", bTables.length),
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
  size: TableSizeConfig,
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

  const newTables = distributeIntoTables(entries, size);
  const rounds: RoundRow[] = [];
  const seats: SeatRow[] = [];
  newTables.forEach((playerIds, idx) => {
    const round_id = `${bracket}${nextGen}-${idx + 1}`;
    rounds.push({
      round_id,
      bracket,
      stage: stageLabel(bracket, newTables.length),
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
