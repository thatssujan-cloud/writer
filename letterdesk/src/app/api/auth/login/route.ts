import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { q1, run } from "@/lib/db";
import { signToken, setSessionCookie } from "@/lib/auth";
import { loginSchema, formatZodError } from "@/lib/validation";

export const runtime = "nodejs";

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
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: formatZodError(parsed.error) }, { status: 400 });
  }
  const { email, password } = parsed.data;
  const user = q1<{ id: number; email: string; name: string; password_hash: string }>(
    "SELECT id, email, name, password_hash FROM users WHERE email = ?", { 0: email.toLowerCase() }
  );
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    // identical message for unknown email vs wrong password
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }
  const token = signToken(user.id, user.email);
  setSessionCookie(token);
  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
}
