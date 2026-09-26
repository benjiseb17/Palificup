import { NextRequest, NextResponse } from "next/server";
import {
  getBracketState,
  groupIntoTables,
  planFromPoules,
  planNextBracketRound,
  planPoules,
  tableSizeConfig,
} from "@/lib/bracket";
import { setConfig } from "@/lib/config";
import { getPlayers } from "@/lib/players";
import { createRounds, createSeats, getRounds, getSeats, setFinishRank } from "@/lib/rounds";
import { appendRows, resetDemoStore } from "@/lib/sheets";

const TEAMS = [
  "Les Dés d'Or",
  "Team Maskhouri",
  "Bluffeurs Unis",
  "Sans Pitié",
  "Escape Gang",
  "Les Poulpitos",
  "Ousmane Ballon d'Or",
  "Magic Girls",
  "Quai16",
  "Perudogs",
];
const PLAYER_COUNT = 100;
const FINAL_SEATS = 5;
const REPECHAGE_ENABLED = true;
const POULE_QUALIFIERS = 1;
const B_REPECHAGE_COUNT = 1;
const A_BUDGET = FINAL_SEATS - B_REPECHAGE_COUNT;
const SIZE = tableSizeConfig(FINAL_SEATS);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function simulate(tableSeats: { player_id: string; _row: number }[]) {
  const order = shuffle(tableSeats);
  for (let i = 0; i < order.length; i++) {
    await setFinishRank(order[i], i + 1);
  }
}

/**
 * POST body (all optional):
 * - name: insert this real name as one of the 100 players so you can log in
 *   as yourself instead of "Joueur N".
 * - advance: fast-forward through Poules + part of the brackets to show off
 *   every screen at once. Defaults to false — a fresh seed starts at the
 *   Poules stage, unplayed, like a real tournament launch.
 */
export async function POST(req: NextRequest) {
  if (process.env.DEMO_MODE !== "1") {
    return NextResponse.json({ error: "Mode démo désactivé." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const customName = typeof body?.name === "string" ? body.name.trim() : "";
  const advance = body?.advance === true;

  resetDemoStore();

  const players = Array.from({ length: PLAYER_COUNT }, (_, i) => ({
    id: String(i + 1),
    name: customName && i === 0 ? customName : `Joueur ${i + 1}`,
    team: TEAMS[i % TEAMS.length],
    seed: "",
  }));
  await appendRows("Players", ["id", "name", "team", "seed"], players);
  await setConfig("tournament_code", "DEMO");
  await setConfig("table_target_size", "5");
  await setConfig("repechage_enabled", "true");
  await setConfig("poule_qualifiers", String(POULE_QUALIFIERS));
  await setConfig("b_repechage_count", String(B_REPECHAGE_COUNT));
  await setConfig("status", "running");

  const allPlayers = await getPlayers();
  const { rounds: pRounds, seats: pSeats } = planPoules(allPlayers, SIZE);
  await createRounds(pRounds);
  await createSeats(pSeats);

  if (!advance) {
    return NextResponse.json({
      ok: true,
      stage: "poules",
      tournamentCode: "DEMO",
      yourName: customName || null,
    });
  }

  // Simulate every poule result.
  let rounds = await getRounds();
  let seats = await getSeats();
  let tables = groupIntoTables(rounds, seats);
  for (const t of [...tables.values()].filter((t) => t.round.bracket === "POULE")) {
    await simulate(t.seats);
  }

  // Split into Tableau A / Tableau B.
  rounds = await getRounds();
  seats = await getSeats();
  tables = groupIntoTables(rounds, seats);
  const pouleTables = [...tables.values()].filter((t) => t.round.bracket === "POULE");
  const { aRounds, aSeats, bRounds, bSeats } = planFromPoules(
    pouleTables,
    SIZE,
    REPECHAGE_ENABLED,
    POULE_QUALIFIERS
  );
  await createRounds([...aRounds, ...bRounds]);
  await createSeats([...aSeats, ...bSeats]);

  // Play Tableau A out to completion (it converges fast for small fields).
  for (;;) {
    rounds = await getRounds();
    seats = await getSeats();
    tables = groupIntoTables(rounds, seats);
    const aTables = [...tables.values()].filter((t) => t.round.bracket === "A");
    const state = getBracketState(aTables, A_BUDGET);
    if (state.status === "done") break;
    if (state.status === "ready-to-advance") {
      const { rounds: newR, seats: newS } = planNextBracketRound("A", state.tables, SIZE);
      await createRounds(newR);
      await createSeats(newS);
      continue;
    }
    for (const t of state.tables) await simulate(t.seats);
  }

  // Play Tableau B partway: advance full rounds, then leave the LAST table of
  // the current round un-played so the demo shows a live "waiting for results" state.
  let pendingRoundId: string | null = null;
  for (;;) {
    rounds = await getRounds();
    seats = await getSeats();
    tables = groupIntoTables(rounds, seats);
    const bTables = [...tables.values()].filter((t) => t.round.bracket === "B");
    const state = getBracketState(bTables, B_REPECHAGE_COUNT);
    if (state.status === "done") break; // small demo field: stop if it finishes anyway
    if (state.status === "ready-to-advance") {
      const { rounds: newR, seats: newS } = planNextBracketRound("B", state.tables, SIZE);
      await createRounds(newR);
      await createSeats(newS);
      continue;
    }
    const toPlay = state.tables.slice(0, -1);
    const pending = state.tables[state.tables.length - 1];
    for (const t of toPlay) await simulate(t.seats);
    pendingRoundId = pending.round.round_id;
    break;
  }

  return NextResponse.json({
    ok: true,
    stage: "advanced",
    pendingRoundId,
    tournamentCode: "DEMO",
    yourName: customName || null,
  });
}
