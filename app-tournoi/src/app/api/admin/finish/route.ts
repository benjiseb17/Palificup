import { NextResponse } from "next/server";
import { groupIntoTables, isTableComplete } from "@/lib/bracket";
import { setConfig } from "@/lib/config";
import { getRounds, getSeats } from "@/lib/rounds";
import { isAdmin } from "@/lib/session";

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [rounds, seats] = await Promise.all([getRounds(), getSeats()]);
  const tables = groupIntoTables(rounds, seats);
  const finalTable = [...tables.values()].find((t) => t.round.bracket === "FINAL");

  if (!finalTable || !isTableComplete(finalTable)) {
    return NextResponse.json(
      { error: "La Grande Finale n'a pas encore de résultat complet." },
      { status: 400 }
    );
  }

  await setConfig("status", "finished");
  return NextResponse.json({ ok: true });
}
