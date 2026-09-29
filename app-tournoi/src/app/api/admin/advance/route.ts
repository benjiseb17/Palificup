import { NextRequest, NextResponse } from "next/server";
import { getBracketState, groupIntoTables, parseRoundId, planNextBracketRound } from "@/lib/bracket";
import { createRounds, createSeats, getRounds, getSeats } from "@/lib/rounds";
import { isAdmin } from "@/lib/session";
import { loadTournamentData, qualifiersForRound, targetForRound } from "@/lib/tournament";

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
  const { finalSeats, tableTargets, qualifierTargets, repechageEnabled, bRepechageCount } =
    await loadTournamentData();
  const tables = groupIntoTables(rounds, seats);
  const bracketTables = [...tables.values()].filter((t) => t.round.bracket === bracket);

  if (bracketTables.length === 0) {
    return NextResponse.json({ error: `Tableau ${bracket} pas encore généré.` }, { status: 400 });
  }

  const currentGen = Math.max(
    ...bracketTables.map((t) => parseRoundId(t.round.round_id).gen)
  );
  const budget =
    bracket === "A"
      ? repechageEnabled
        ? finalSeats - bRepechageCount
        : finalSeats
      : bRepechageCount;
  const qualifiersPerRound = qualifiersForRound(qualifierTargets, bracket, currentGen);
  const state = getBracketState(bracketTables, budget, qualifiersPerRound);
  if (state.status !== "ready-to-advance") {
    return NextResponse.json(
      { error: `Le tableau ${bracket} n'est pas prêt à avancer (statut: ${state.status}).` },
      { status: 400 }
    );
  }

  const nextGen = parseRoundId(state.tables[0].round.round_id).gen + 1;

  // Table numbers run continuously across both brackets, Tableau A first
  // then Tableau B: when B reaches a gen A is already at, its numbers
  // continue right after A's for that same round.
  const otherBracket = bracket === "A" ? "B" : "A";
  const otherGenTableCount = [...tables.values()].filter(
    (t) => t.round.bracket === otherBracket && parseRoundId(t.round.round_id).gen === nextGen
  ).length;
  const startTableNumber = bracket === "B" ? otherGenTableCount + 1 : 1;

  const { rounds: newRounds, seats: newSeats } = planNextBracketRound(
    bracket,
    state.tables,
    targetForRound(tableTargets, bracket, nextGen),
    qualifiersPerRound,
    startTableNumber
  );
  await createRounds(newRounds);
  await createSeats(newSeats);

  return NextResponse.json({ ok: true, newTableCount: newRounds.length });
}
