import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";

/** Cheap admin-session check for pages that render differently for admins
 * without otherwise needing any admin data (e.g. /classement's nav). */
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
