import { NextResponse } from "next/server";
import { clearPlayerSession } from "@/lib/session";

export async function POST() {
  await clearPlayerSession();
  return NextResponse.json({ ok: true });
}
