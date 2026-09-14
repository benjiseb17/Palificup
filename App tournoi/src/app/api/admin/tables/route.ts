import { NextResponse } from "next/server";
import { groupIntoTables, isTableComplete, parseRoundId } from "@/lib/bracket";
import { getPlayers } from "@/lib/players";
import { getRounds, getSeats } from "@/lib/rounds";
import { isAdmin } from "@/lib/session";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [rounds, seats, players] = await Promise.all([
    getRounds(),
    getSeats(),
    getPlayers(),
  ]);
  const nameById = new Map(players.map((p) => [p.id, p.name]));
  const tables = groupIntoTables(rounds, seats);
  const hasDownstream = new Set(seats.map((s) => s.from_round_id).filter(Boolean));

  const list = [...tables.values()]
    .map((t) => {
      const parsed = parseRoundId(t.round.round_id);
      return {
        round_id: t.round.round_id,
        bracket: t.round.bracket,
        stage: t.round.stage,
        table_number: t.round.table_number,
        gen: parsed.gen,
        complete: isTableComplete(t),
        hasDownstream: hasDownstream.has(t.round.round_id),
        seats: [...t.seats]
          .sort((a, b) => (nameById.get(a.player_id) ?? "").localeCompare(nameById.get(b.player_id) ?? ""))
          .map((s) => ({
            player_id: s.player_id,
            name: nameById.get(s.player_id) ?? "?",
            finish_rank: s.finish_rank,
          })),
      };
    })
    .sort((a, b) => {
      const order = { POULE: 0, A: 1, B: 2, FINAL: 3 } as const;
      const oa = order[a.bracket as keyof typeof order];
      const ob = order[b.bracket as keyof typeof order];
      if (oa !== ob) return oa - ob;
      if (a.gen !== b.gen) return a.gen - b.gen;
      return a.round_id.localeCompare(b.round_id, undefined, { numeric: true });
    });

  return NextResponse.json({ tables: list });
}
