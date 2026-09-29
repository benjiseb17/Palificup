import { NextResponse } from "next/server";
import { groupIntoTables, isTableComplete, parseRoundId, type TableState } from "@/lib/bracket";
import { getPlayers } from "@/lib/players";
import { getRounds, getSeats } from "@/lib/rounds";
import { isAdmin } from "@/lib/session";

/**
 * Only the tables of the stage currently being played — the point is to
 * project this on a shared screen so everyone can find their table, not to
 * relive the whole tournament history. Once the Grande Finale exists it's
 * the only thing worth showing; otherwise Tableau A and B each show their
 * own latest round (they progress independently), and before either exists
 * it's just the Poules.
 */
function currentStageTables(tables: TableState[]): TableState[] {
  const final = tables.filter((t) => t.round.bracket === "FINAL");
  if (final.length > 0) return final;

  const hasBracket = tables.some((t) => t.round.bracket === "A" || t.round.bracket === "B");
  if (hasBracket) {
    return (["A", "B"] as const).flatMap((bracket) => {
      const list = tables.filter((t) => t.round.bracket === bracket);
      if (list.length === 0) return [];
      const maxGen = Math.max(...list.map((t) => parseRoundId(t.round.round_id).gen));
      return list.filter((t) => parseRoundId(t.round.round_id).gen === maxGen);
    });
  }

  return tables.filter((t) => t.round.bracket === "POULE");
}

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [rounds, seats, players] = await Promise.all([getRounds(), getSeats(), getPlayers()]);
  const nameById = new Map(players.map((p) => [p.id, p.name]));
  const tables = [...groupIntoTables(rounds, seats).values()];
  const current = currentStageTables(tables);

  const order = { POULE: 0, A: 1, B: 2, FINAL: 3 } as const;
  const list = current
    .map((t) => ({
      round_id: t.round.round_id,
      bracket: t.round.bracket,
      stage: t.round.stage,
      table_number: Number(t.round.table_number) || 0,
      complete: isTableComplete(t),
      seats: [...t.seats]
        .sort((a, b) => (nameById.get(a.player_id) ?? "").localeCompare(nameById.get(b.player_id) ?? ""))
        .map((s) => ({ player_id: s.player_id, name: nameById.get(s.player_id) ?? "?" })),
    }))
    .sort((a, b) => {
      const oa = order[a.bracket as keyof typeof order];
      const ob = order[b.bracket as keyof typeof order];
      return oa !== ob ? oa - ob : a.table_number - b.table_number;
    });

  return NextResponse.json({ tables: list });
}
