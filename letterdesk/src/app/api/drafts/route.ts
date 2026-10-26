import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { q, q1, run } from "@/lib/db";
import { draftSaveSchema, formatZodError } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const rows = q<any>(
    `SELECT id, researcher_id, researcher_name, mode, subject, body, status, updated_at
     FROM email_drafts WHERE user_id = @uid ORDER BY updated_at DESC LIMIT 50`, { uid: s.userId });
  return NextResponse.json({ drafts: rows });
}

export async function POST(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = draftSaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: formatZodError(parsed.error) }, { status: 400 });
  }
  const d = parsed.data;
  const info = run(
    `INSERT INTO email_drafts (user_id, researcher_id, researcher_name, mode, subject, body)
     VALUES (@uid, @rid, @rn, @mode, @subj, @body)`,
    { uid: s.userId, rid: d.researcherId || null, rn: d.researcherName || null, mode: d.mode || null, subj: d.subject, body: d.body }
  );
  return NextResponse.json({ ok: true, id: Number(info.lastInsertRowid) }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid draft id." }, { status: 400 });
  const parsed = draftSaveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", fields: formatZodError(parsed.error) }, { status: 400 });
  const owned = q1<{ id: number }>("SELECT id FROM email_drafts WHERE id = @id AND user_id = @uid", { id, uid: s.userId });
  if (!owned) return NextResponse.json({ error: "Draft not found or not yours." }, { status: 404 });
  run(
    `UPDATE email_drafts SET subject=@subj, body=@body, researcher_id=@rid, researcher_name=@rn, mode=@mode,
     updated_at=datetime('now') WHERE id=@id AND user_id=@uid`,
    { id, uid: s.userId, subj: parsed.data.subject, body: parsed.data.body, rid: parsed.data.researcherId || null, rn: parsed.data.researcherName || null, mode: parsed.data.mode || null }
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid draft id." }, { status: 400 });
  const owned = q1<{ id: number }>("SELECT id FROM email_drafts WHERE id = @id AND user_id = @uid", { id, uid: s.userId });
  if (!owned) return NextResponse.json({ error: "Draft not found or not yours." }, { status: 404 });
  run(`DELETE FROM email_drafts WHERE id = @id AND user_id = @uid`, { id, uid: s.userId });
  return NextResponse.json({ ok: true });
}
