import { NextResponse } from "next/server";
import { getBracketState, groupIntoTables, parseRoundId, planFinal, type TableState } from "@/lib/bracket";
import { createRounds, createSeats, getRounds, getSeats } from "@/lib/rounds";
import { isAdmin } from "@/lib/session";
import { loadTournamentData, qualifiersForRound } from "@/lib/tournament";

function genOf(list: TableState[]): number {
  return list.length > 0 ? Math.max(...list.map((t) => parseRoundId(t.round.round_id).gen)) : 1;
}

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [rounds, seats] = await Promise.all([getRounds(), getSeats()]);
  const { finalSeats, repechageEnabled, bRepechageCount, qualifierTargets } =
    await loadTournamentData();
  const aBudget = repechageEnabled ? finalSeats - bRepechageCount : finalSeats;
  const tables = groupIntoTables(rounds, seats);

  const alreadyExists = rounds.some((r) => r.bracket === "FINAL");
  if (alreadyExists) {
    return NextResponse.json({ error: "La Grande Finale a déjà été générée." }, { status: 409 });
  }

  const aTables = [...tables.values()].filter((t) => t.round.bracket === "A");
  const bTables = [...tables.values()].filter((t) => t.round.bracket === "B");
  const aState = getBracketState(
    aTables,
    aBudget,
    qualifiersForRound(qualifierTargets, "A", genOf(aTables))
  );
  const bState = repechageEnabled
    ? getBracketState(bTables, bRepechageCount, qualifiersForRound(qualifierTargets, "B", genOf(bTables)))
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

  const bChampionSeats = repechageEnabled && bState?.status === "done" ? bState.qualifiedSeats : [];

  const { rounds: newRounds, seats: newSeats } = planFinal(aState.qualifiedSeats, bChampionSeats);
  await createRounds(newRounds);
  await createSeats(newSeats);

  return NextResponse.json({ ok: true, seatCount: newSeats.length });
}
