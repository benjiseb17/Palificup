import { NextRequest, NextResponse } from "next/server";
import { STAGE_SIZE_KEYS, getConfig, setConfig } from "@/lib/config";
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
  const a_qualifiers_per_round =
    typeof body?.a_qualifiers_per_round === "string" ? body.a_qualifiers_per_round.trim() : undefined;
  const b_qualifiers_per_round =
    typeof body?.b_qualifiers_per_round === "string" ? body.b_qualifiers_per_round.trim() : undefined;

  if (tournament_code) await setConfig("tournament_code", tournament_code);
  if (table_target_size) await setConfig("table_target_size", table_target_size);
  if (repechage_enabled !== undefined)
    await setConfig("repechage_enabled", repechage_enabled ? "true" : "false");
  if (poule_qualifiers) await setConfig("poule_qualifiers", poule_qualifiers);
  if (b_repechage_count) await setConfig("b_repechage_count", b_repechage_count);
  if (a_qualifiers_per_round) await setConfig("a_qualifiers_per_round", a_qualifiers_per_round);
  if (b_qualifiers_per_round) await setConfig("b_qualifiers_per_round", b_qualifiers_per_round);
  for (const key of STAGE_SIZE_KEYS) {
    const value = typeof body?.[key] === "string" ? body[key].trim() : "";
    if (value) await setConfig(key, value);
  }
  const existing = await getConfig();
  if (!existing.status) await setConfig("status", "setup");

  return NextResponse.json({ ok: true });
}
