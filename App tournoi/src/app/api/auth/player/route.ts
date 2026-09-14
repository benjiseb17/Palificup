import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { findPlayerByName } from "@/lib/players";
import { setPlayerSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name : "";
  const code = typeof body?.code === "string" ? body.code : "";

  if (!name.trim() || !code.trim()) {
    return NextResponse.json(
      { error: "Nom et code du tournoi requis." },
      { status: 400 }
    );
  }

  const config = await getConfig();
  if (!config.tournament_code || code.trim() !== config.tournament_code) {
    return NextResponse.json({ error: "Code du tournoi incorrect." }, { status: 401 });
  }

  const player = await findPlayerByName(name);
  if (!player) {
    return NextResponse.json(
      { error: "Nom introuvable dans la liste des joueurs. Vérifie l'orthographe." },
      { status: 404 }
    );
  }

  await setPlayerSession(player.id);
  return NextResponse.json({ player: { id: player.id, name: player.name } });
}
