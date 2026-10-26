import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { q, q1, run } from "@/lib/db";

export const runtime = "nodejs";

// GET returns the user's saved opportunities (their own shortlist).
export async function GET(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const rows = q<{ opportunity_id: string; payload: string; saved_at: string }>(
    "SELECT opportunity_id, payload, saved_at FROM saved_opportunities WHERE user_id = @uid ORDER BY saved_at DESC",
    { uid: s.userId }
  );
  return NextResponse.json({ saved: rows.map((r) => ({ id: r.opportunity_id, payload: JSON.parse(r.payload), savedAt: r.saved_at })) });
}

export async function POST(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = String(body?.id ?? "");
  const payload = typeof body?.payload === "string" ? body.payload : null;
  if (!id || !payload || payload.length > 100_000) {
    return NextResponse.json({ error: "Invalid opportunity record." }, { status: 400 });
  }
  try { JSON.parse(payload); } catch { return NextResponse.json({ error: "Invalid opportunity data." }, { status: 400 }); }
  run(
    `INSERT INTO saved_opportunities (user_id, opportunity_id, payload) VALUES (@uid, @oid, @p)
     ON CONFLICT(user_id, opportunity_id) DO UPDATE SET payload = excluded.payload, saved_at = datetime('now')`,
    { uid: s.userId, oid: id, p: payload }
  );
  void q1;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "Missing opportunity id." }, { status: 400 });
  run(`DELETE FROM saved_opportunities WHERE user_id = @uid AND opportunity_id = @oid`, { uid: s.userId, oid: id });
  return NextResponse.json({ ok: true });
}
