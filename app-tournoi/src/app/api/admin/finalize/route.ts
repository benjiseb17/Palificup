import { NextResponse } from "next/server";
import { getBracketState, groupIntoTables, planFinal, rankedSeats } from "@/lib/bracket";
import { createRounds, createSeats, getRounds, getSeats } from "@/lib/rounds";
import { isAdmin } from "@/lib/session";
import { loadTournamentData } from "@/lib/tournament";

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [rounds, seats] = await Promise.all([getRounds(), getSeats()]);
  const { finalSeats, repechageEnabled } = await loadTournamentData();
  const tables = groupIntoTables(rounds, seats);

  const alreadyExists = rounds.some((r) => r.bracket === "FINAL");
  if (alreadyExists) {
    return NextResponse.json({ error: "La Grande Finale a déjà été générée." }, { status: 409 });
  }

  const aTables = [...tables.values()].filter((t) => t.round.bracket === "A");
  const bTables = [...tables.values()].filter((t) => t.round.bracket === "B");
  const aState = getBracketState("A", aTables, finalSeats, repechageEnabled);
  const bState = repechageEnabled
    ? getBracketState("B", bTables, finalSeats, repechageEnabled)
    : null;

  const bReady = repechageEnabled ? bState?.status === "done" : true;
  if (aState.status !== "done" || !bReady) {
    return NextResponse.json(
      {
        error: repechageEnabled
          ? "Les tableaux A et B doivent tous les deux être terminés avant la Grande Finale."
          : "Le tableau A doit être terminé avant la Grande Finale.",
      },
      { status: 400 }
    );
  }

  const aChampionSeats = aState.tables.map((t) => rankedSeats(t)[0]);
  const bChampionSeat =
    repechageEnabled && bState?.status === "done" ? rankedSeats(bState.tables[0])[0] : null;

  const { rounds: newRounds, seats: newSeats } = planFinal(aChampionSeats, bChampionSeat);
  await createRounds(newRounds);
  await createSeats(newSeats);

  return NextResponse.json({ ok: true, seatCount: newSeats.length });
}
