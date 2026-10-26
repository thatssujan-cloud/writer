import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";

const COOKIE = "ld_session";
const SECRET = process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me";

export function signToken(userId: number, email: string): string {
  return jwt.sign({ sub: String(userId), email }, SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): { userId: number; email: string } | null {
  try {
    const payload = jwt.verify(token, SECRET);
    if (typeof payload === "object" && payload && typeof payload.sub === "string") {
      return { userId: Number(payload.sub), email: String(payload.email ?? "") };
    }
    return null;
  } catch {
    return null;
  }
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE);
}

/** For API routes: read token from request cookies. Returns session or null. */
export function getSession(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/** For server-rendered pages / route handlers using next/headers cookies. */
export function getSessionFromCookies() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}
