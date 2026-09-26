import { NextResponse } from "next/server";
import { computeClassement, computeTeamClassement } from "@/lib/scoring";
import { loadTournamentData } from "@/lib/tournament";

export async function GET() {
  const {
    players,
    rounds,
    seats,
    repechageEnabled,
    pouleQualifiers,
    aQualifiersPerRound,
    bQualifiersPerRound,
  } = await loadTournamentData();
  const individual = computeClassement(
    players,
    rounds,
    seats,
    repechageEnabled,
    pouleQualifiers,
    aQualifiersPerRound,
    bQualifiersPerRound
  );
  const team = computeTeamClassement(individual);

  return NextResponse.json({
    individual: individual.map((e) => ({
      rank: e.rank,
      name: e.player.name,
      team: e.player.team,
      points: e.points,
      stage: e.stage,
    })),
    team,
  });
}
