import { NextResponse } from "next/server";
import { setConfig } from "@/lib/config";
import { clearTournament } from "@/lib/rounds";
import { isAdmin } from "@/lib/session";

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await clearTournament();
  await setConfig("status", "setup");
  return NextResponse.json({ ok: true });
}
