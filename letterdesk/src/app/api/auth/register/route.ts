import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { getDb, q1, run } from "@/lib/db";
import { signToken, setSessionCookie } from "@/lib/auth";
import { registerSchema, formatZodError } from "@/lib/validation";

export const runtime = "nodejs";

// naive in-memory rate limit for auth endpoints
const hits = new Map<string, { n: number; t: number }>();
function rateLimited(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) { hits.set(ip, { n: 1, t: now }); return false; }
  h.n += 1;
  return h.n > 10;
}

export async function POST(req: NextRequest) {
  if (rateLimited(req.headers.get("x-forwarded-for") ?? "local")) {
    return NextResponse.json({ error: "Too many attempts. Please wait a minute." }, { status: 429 });
  }
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: formatZodError(parsed.error) }, { status: 400 });
  }
  const { email, password, name } = parsed.data;
  const db = getDb();
  const existing = q1<{ id: number }>("SELECT id FROM users WHERE email = ?", { 0: email.toLowerCase() });
  if (existing) {
    return NextResponse.json({ error: "Validation failed", fields: { email: "An account with this email already exists." } }, { status: 409 });
  }
  void db; // keep single-connection usage simple
  const hash = await bcrypt.hash(password, 10);
  const info = run(
    `INSERT INTO users (email, name, password_hash) VALUES (@email, @name, @hash)`,
    { email: email.toLowerCase(), name, hash }
  );
  const userId = Number(info.lastInsertRowid);
  run(`INSERT INTO user_preferences (user_id, data) VALUES (?, ?)`, { 0: userId, 1: "{}" });
  const token = signToken(userId, email);
  setSessionCookie(token);
  return NextResponse.json({ ok: true, user: { id: userId, email, name } }, { status: 201 });
}
