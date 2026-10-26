import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { q1, run } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const id = decodeURIComponent(params.id);
  const body = await req.json().catch(() => ({}));
  const payload = typeof body?.payload === "string" ? body.payload : null;
  if (!payload) return NextResponse.json({ error: "Missing researcher payload." }, { status: 400 });
  // basic size guard
  if (payload.length > 200_000) return NextResponse.json({ error: "Record too large to save." }, { status: 413 });
  try {
    JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Invalid record data." }, { status: 400 });
  }
  run(
    `INSERT INTO saved_researchers (user_id, researcher_id, payload) VALUES (@uid, @rid, @p)
     ON CONFLICT(user_id, researcher_id) DO UPDATE SET payload = excluded.payload, saved_at = datetime('now')`,
    { uid: s.userId, rid: id, p: payload }
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const id = decodeURIComponent(params.id);
  run(`DELETE FROM saved_researchers WHERE user_id = @uid AND researcher_id = @rid`, { uid: s.userId, rid: id });
  void q1;
  return NextResponse.json({ ok: true });
}
