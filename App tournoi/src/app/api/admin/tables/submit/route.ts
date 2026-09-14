import { NextRequest, NextResponse } from "next/server";
import { autoAdvanceTournament } from "@/lib/autoAdvance";
import { getRounds, getSeats, setFinishRank } from "@/lib/rounds";
import { isAdmin } from "@/lib/session";

/**
 * Same as /api/table/submit but for the admin: no "already advanced" lock,
 * so a mistake can always be corrected even after the next round exists.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const round_id = typeof body?.round_id === "string" ? body.round_id : "";
  const order: string[] = Array.isArray(body?.order) ? body.order : [];
  if (!round_id || order.length === 0) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const [rounds, seats] = await Promise.all([getRounds(), getSeats()]);
  const round = rounds.find((r) => r.round_id === round_id);
  if (!round) {
    return NextResponse.json({ error: "Table introuvable." }, { status: 404 });
  }

  const tableSeats = seats.filter((s) => s.round_id === round_id);
  if (tableSeats.length === 0) {
    return NextResponse.json({ error: "Table vide." }, { status: 404 });
  }

  const tablePlayerIds = new Set(tableSeats.map((s) => s.player_id));
  const validOrder =
    order.length === tableSeats.length &&
    order.every((id) => tablePlayerIds.has(id)) &&
    new Set(order).size === order.length;
  if (!validOrder) {
    return NextResponse.json(
      { error: "L'ordre soumis ne correspond pas aux joueurs de la table." },
      { status: 400 }
    );
  }

  await Promise.all(
    order.map((pid, idx) => {
      const seat = tableSeats.find((s) => s.player_id === pid)!;
      return setFinishRank(seat, idx + 1);
    })
  );

  await autoAdvanceTournament();

  return NextResponse.json({ ok: true });
}
