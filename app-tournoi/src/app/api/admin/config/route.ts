import { NextRequest, NextResponse } from "next/server";
import { getConfig, setConfig } from "@/lib/config";
import { isAdmin } from "@/lib/session";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await getConfig());
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const tournament_code = typeof body?.tournament_code === "string" ? body.tournament_code.trim() : undefined;
  const table_target_size = typeof body?.table_target_size === "string" ? body.table_target_size.trim() : undefined;

  if (tournament_code) await setConfig("tournament_code", tournament_code);
  if (table_target_size) await setConfig("table_target_size", table_target_size);
  const existing = await getConfig();
  if (!existing.status) await setConfig("status", "setup");

  return NextResponse.json({ ok: true });
}
