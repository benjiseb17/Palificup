import { NextRequest, NextResponse } from "next/server";
import { getBracketState, groupIntoTables, planNextBracketRound } from "@/lib/bracket";
import { createRounds, createSeats, getRounds, getSeats } from "@/lib/rounds";
import { isAdmin } from "@/lib/session";
import { loadTournamentData } from "@/lib/tournament";

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const bracket = body?.bracket === "A" || body?.bracket === "B" ? body.bracket : null;
  if (!bracket) {
    return NextResponse.json({ error: "bracket invalide." }, { status: 400 });
  }

  const [rounds, seats] = await Promise.all([getRounds(), getSeats()]);
  const { finalSeats } = await loadTournamentData();
  const tables = groupIntoTables(rounds, seats);
  const bracketTables = [...tables.values()].filter((t) => t.round.bracket === bracket);

  if (bracketTables.length === 0) {
    return NextResponse.json({ error: `Tableau ${bracket} pas encore généré.` }, { status: 400 });
  }

  const state = getBracketState(bracket, bracketTables, finalSeats);
  if (state.status !== "ready-to-advance") {
    return NextResponse.json(
      { error: `Le tableau ${bracket} n'est pas prêt à avancer (statut: ${state.status}).` },
      { status: 400 }
    );
  }

  const { rounds: newRounds, seats: newSeats } = planNextBracketRound(bracket, state.tables);
  await createRounds(newRounds);
  await createSeats(newSeats);

  return NextResponse.json({ ok: true, newTableCount: newRounds.length });
}
