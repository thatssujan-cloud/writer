import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { run } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const runtime = "nodejs";

const pwSchema = z.object({ password: z.string().min(8, "Password must be at least 8 characters.") });

// Change password
export async function PUT(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = pwSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const hash = await bcrypt.hash(parsed.data.password, 10);
  run(`UPDATE users SET password_hash=@h WHERE id=@uid`, { h: hash, uid: s.userId });
  return NextResponse.json({ ok: true });
}

// Delete account and all associated data (cascade handles rows).
export async function DELETE(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const confirm = req.nextUrl.searchParams.get("confirm");
  if (confirm !== "DELETE") {
    return NextResponse.json({ error: "Pass confirm=DELETE to permanently remove your account and all records." }, { status: 400 });
  }
  const fs = await import("fs");
  const path = await import("path");
  // remove uploaded CV files belonging to this user
  try {
    const dir = path.join(process.cwd(), "data", "uploads");
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (f.startsWith(`${s.userId}-`)) fs.unlinkSync(path.join(dir, f));
      }
    }
  } catch {}
  run(`DELETE FROM users WHERE id=@uid`, { uid: s.userId });
  const { clearSessionCookie } = await import("@/lib/auth");
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
