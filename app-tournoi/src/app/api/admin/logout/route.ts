import { NextResponse } from "next/server";
import { clearAdminSession } from "@/lib/session";

export async function POST() {
  await clearAdminSession();
  return NextResponse.json({ ok: true });
}
