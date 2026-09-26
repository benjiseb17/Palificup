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
  const repechage_enabled = typeof body?.repechage_enabled === "boolean" ? body.repechage_enabled : undefined;
  const poule_qualifiers = typeof body?.poule_qualifiers === "string" ? body.poule_qualifiers.trim() : undefined;
  const b_repechage_count =
    typeof body?.b_repechage_count === "string" ? body.b_repechage_count.trim() : undefined;

  if (tournament_code) await setConfig("tournament_code", tournament_code);
  if (table_target_size) await setConfig("table_target_size", table_target_size);
  if (repechage_enabled !== undefined)
    await setConfig("repechage_enabled", repechage_enabled ? "true" : "false");
  if (poule_qualifiers) await setConfig("poule_qualifiers", poule_qualifiers);
  if (b_repechage_count) await setConfig("b_repechage_count", b_repechage_count);
  const existing = await getConfig();
  if (!existing.status) await setConfig("status", "setup");

  return NextResponse.json({ ok: true });
}
