import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { q1, run } from "@/lib/db";

export const runtime = "nodejs";

// CV upload: store file on server under data/uploads (never publicly served).
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXT = ["pdf", "doc", "docx"];

export async function POST(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("cv");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return NextResponse.json({ error: `Unsupported file type ".${ext}". Allowed: PDF, DOC, DOCX.` }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File exceeds the 5 MB limit." }, { status: 413 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const path = await import("path");
  const fs = await import("fs");
  const dir = path.join(process.cwd(), "data", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  const safeName = `${s.userId}-${Date.now()}.${ext}`; // user id prefix keeps ownership explicit
  fs.writeFileSync(path.join(dir, safeName), buf);
  const existing = q1<{ id: number }>("SELECT id FROM academic_profiles WHERE user_id=@uid", { uid: s.userId });
  if (existing) {
    run(`UPDATE academic_profiles SET cv_filename=@n WHERE user_id=@uid`, { n: safeName, uid: s.userId });
  } else {
    run(`INSERT INTO academic_profiles (user_id, data, cv_filename) VALUES (@uid, '{}', @n)`, { uid: s.userId, n: safeName });
  }
  return NextResponse.json({ ok: true, filename: safeName, size: file.size });
}

export async function DELETE(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const row = q1<{ cv_filename: string | null }>("SELECT cv_filename FROM academic_profiles WHERE user_id=@uid", { uid: s.userId });
  if (row?.cv_filename) {
    const path = await import("path");
    const fs = await import("fs");
    try { fs.unlinkSync(path.join(process.cwd(), "data", "uploads", row.cv_filename)); } catch {}
    run(`UPDATE academic_profiles SET cv_filename = NULL WHERE user_id=@uid`, { uid: s.userId });
  }
  return NextResponse.json({ ok: true });
}
