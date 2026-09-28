import { NextRequest, NextResponse } from "next/server";
import { getRounds, getSeats, setFinishRank } from "@/lib/rounds";
import { getPlayerSession } from "@/lib/session";
import { invalidateTabs } from "@/lib/sheets";

export async function POST(req: NextRequest) {
  const playerId = await getPlayerSession();
  if (!playerId) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const round_id = typeof body?.round_id === "string" ? body.round_id : "";
  const order: string[] = Array.isArray(body?.order) ? body.order : [];
  if (!round_id || order.length === 0) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  // The in-memory read cache is per serverless instance: a table that was just
  // created on another instance (e.g. Poules -> Tableau A/B) could still look
  // stale here for a few seconds. Force a fresh read before validating a
  // submission so a genuinely valid result is never wrongly rejected.
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

  const isPlayerAtTable = tableSeats.some((s) => s.player_id === playerId);
  if (!isPlayerAtTable) {
    return NextResponse.json(
      { error: "Tu ne fais pas partie de cette table." },
      { status: 403 }
    );
  }

  const alreadyAdvanced = seats.some((s) => s.from_round_id === round_id);
  if (alreadyAdvanced) {
    return NextResponse.json(
      {
        error:
          "Le tour suivant a déjà été généré à partir de cette table, contacte l'admin pour corriger.",
      },
      { status: 409 }
    );
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

  // The next round is NOT generated automatically anymore — the admin
  // triggers each stage explicitly from /admin (poules -> A/B, next round
  // within a bracket, Grande Finale), so they can review results and adjust
  // settings like "qualifiés par tour" between stages before advancing.

  return NextResponse.json({ ok: true });
}
