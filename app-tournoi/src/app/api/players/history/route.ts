import { NextRequest, NextResponse } from "next/server";
import { getExternalHistory } from "@/lib/externalHistory";
import { getPlayerSession } from "@/lib/session";

/**
 * Historical record of a player across past Palificup tournaments, read
 * live from the separate classement spreadsheet (palificup.fr) — nothing is
 * copied into this app's own Sheet. Requires an active player session so
 * it's only reachable from within the tournament (not a public roster leak).
 */
export async function GET(req: NextRequest) {
  const playerId = await getPlayerSession();
  if (!playerId) {
    return NextResponse.json({ error: "not-authenticated" }, { status: 401 });
  }

  const name = req.nextUrl.searchParams.get("name")?.trim() ?? "";
  if (!name) {
    return NextResponse.json({ error: "Nom requis." }, { status: 400 });
  }

  const history = await getExternalHistory(name);
  if (history === null) {
    return NextResponse.json({ available: false });
  }
  return NextResponse.json({ available: true, ...history });
}
