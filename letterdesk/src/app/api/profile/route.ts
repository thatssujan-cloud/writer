import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { q1, run } from "@/lib/db";
import { profileSchema, formatZodError } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const row = q1<{ data: string; cv_filename: string | null }>(
    "SELECT data, cv_filename FROM academic_profiles WHERE user_id = @uid", { uid: s.userId }
  );
  if (!row) return NextResponse.json({ profile: null });
  return NextResponse.json({ profile: JSON.parse(row.data), cvFilename: row.cv_filename ?? null });
}

export async function PUT(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: formatZodError(parsed.error) }, { status: 400 });
  }
  // strip control chars before storing (defense in depth; we never render as HTML anyway)
  const clean = Object.fromEntries(
    Object.entries(parsed.data).map(([k, v]) => [k, typeof v === "string" ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "") : v])
  );
  const existing = q1<{ id: number }>("SELECT id FROM academic_profiles WHERE user_id = @uid", { uid: s.userId });
  if (existing) {
    run(
      `UPDATE academic_profiles SET data = @data, updated_at = datetime('now') WHERE user_id = @uid`,
      { data: JSON.stringify(clean), uid: s.userId }
    );
  } else {
    run(
      `INSERT INTO academic_profiles (user_id, data) VALUES (@uid, @data)`,
      { uid: s.userId, data: JSON.stringify(clean) }
    );
  }
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}

export async function DELETE(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  run(`DELETE FROM academic_profiles WHERE user_id = @uid`, { uid: s.userId });
  return NextResponse.json({ ok: true });
}
