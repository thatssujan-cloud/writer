import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { q } from "@/lib/db";

export const runtime = "nodejs";

// Lists the current user's saved researchers (payload + saved date).
export async function GET(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const rows = q<{ researcher_id: string; payload: string; saved_at: string }>(
    "SELECT researcher_id, payload, saved_at FROM saved_researchers WHERE user_id=@uid ORDER BY saved_at DESC",
    { uid: s.userId }
  );
  return NextResponse.json({ researchers: rows });
}
