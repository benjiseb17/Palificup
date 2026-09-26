import { NextResponse } from "next/server";
import { planPoules } from "@/lib/bracket";
import { setConfig } from "@/lib/config";
import { getPlayers } from "@/lib/players";
import { createRounds, createSeats, getRounds } from "@/lib/rounds";
import { isAdmin } from "@/lib/session";
import { loadTournamentData } from "@/lib/tournament";

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const existingRounds = await getRounds();
  if (existingRounds.length > 0) {
    return NextResponse.json(
      { error: "Le tournoi a déjà été lancé." },
      { status: 409 }
    );
  }

  const players = await getPlayers();
  if (players.length < 4) {
    return NextResponse.json(
      { error: "Il faut au moins 4 joueurs dans l'onglet Players." },
      { status: 400 }
    );
  }

  const { tableTargets } = await loadTournamentData();
  const { rounds, seats } = planPoules(players, tableTargets.poules);
  await createRounds(rounds);
  await createSeats(seats);
  await setConfig("status", "running");

  return NextResponse.json({ ok: true, tableCount: rounds.length });
}
