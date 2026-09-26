import { NextResponse } from "next/server";
import { groupIntoTables, isTableComplete, planFromPoules } from "@/lib/bracket";
import { createRounds, createSeats, getRounds, getSeats } from "@/lib/rounds";
import { isAdmin } from "@/lib/session";
import { loadTournamentData } from "@/lib/tournament";

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [rounds, seats] = await Promise.all([getRounds(), getSeats()]);
  const tables = groupIntoTables(rounds, seats);
  const pouleTables = [...tables.values()].filter((t) => t.round.bracket === "POULE");

  if (pouleTables.length === 0) {
    return NextResponse.json({ error: "Les poules n'ont pas encore été générées." }, { status: 400 });
  }
  if (!pouleTables.every(isTableComplete)) {
    return NextResponse.json(
      { error: "Toutes les poules n'ont pas encore rendu leur résultat." },
      { status: 400 }
    );
  }
  const alreadyGenerated = rounds.some((r) => r.bracket === "A" || r.bracket === "B");
  if (alreadyGenerated) {
    return NextResponse.json(
      { error: "Les tableaux A et B ont déjà été générés." },
      { status: 409 }
    );
  }

  const { tableSize, repechageEnabled, pouleQualifiers } = await loadTournamentData();
  const { aRounds, aSeats, bRounds, bSeats } = planFromPoules(
    pouleTables,
    tableSize,
    repechageEnabled,
    pouleQualifiers
  );
  await createRounds([...aRounds, ...bRounds]);
  await createSeats([...aSeats, ...bSeats]);

  return NextResponse.json({
    ok: true,
    tableauA: aRounds.length,
    tableauB: bRounds.length,
  });
}
