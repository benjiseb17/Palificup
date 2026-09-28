import { NextRequest, NextResponse } from "next/server";
import { getRounds, getSeats, setFinishRank } from "@/lib/rounds";
import { isAdmin } from "@/lib/session";
import { invalidateTabs } from "@/lib/sheets";

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

  // See src/app/api/table/submit/route.ts: force a fresh read so a table just
  // created on another serverless instance is never wrongly seen as stale/empty.
  invalidateTabs(["Rounds", "Seats"]);
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

  // See src/app/api/table/submit/route.ts: stage generation is manual now,
  // triggered from the admin dashboard's own buttons.

  return NextResponse.json({ ok: true });
}
