import { redirect } from "next/navigation";
import { getSessionFromCookies, signToken } from "@/lib/auth";
import { q1 } from "@/lib/db";
import AppShell from "@/components/AppShell";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";

// Dev-only convenience: ?devlogin=name@x.com creates/logs in a local test user.
// Disabled when NODE_ENV=production or DEV_LOGIN=off.
function devLogin(email: string, name: string) {
  if (process.env.NODE_ENV === "production" || process.env.DEV_LOGIN === "off") return null;
  let row = q1<{ id: number; name: string }>("SELECT id, name FROM users WHERE email=@e", { e: email });
  if (!row) {
    const bcrypt = require("bcryptjs");
    const info = q1<any>("SELECT 1") , _ = info; // noop keep import simple
    const { run } = require("@/lib/db");
    const r = run("INSERT INTO users (email, name, password_hash) VALUES (@e,@n,@h)", { e: email, n: name, h: bcrypt.hashSync("devpassword123", 10) });
    row = { id: Number(r.lastInsertRowid), name };
  }
  const token = signToken(row.id, email);
  return { userId: row.id, email, name: row.name, token };
}

export default async function ProfilePage({ searchParams }: { searchParams: { onboarding?: string; devlogin?: string } }) {
  let session = getSessionFromCookies();
  let devToken: string | null = null;
  if (!session && searchParams.devlogin) {
    const parts = decodeURIComponent(searchParams.devlogin).split("|");
    const d = devLogin(parts[0], parts[1] ?? "Test User");
    if (d) { session = { userId: d.userId, email: d.email }; devToken = d.token; }
  }
  if (!session) redirect("/login?next=/profile");
  const user = q1<{ name: string; email: string }>("SELECT name, email FROM users WHERE id=@id", { id: session.userId });
  return (
    <AppShell user={{ name: user?.name ?? "Student", email: session.email }}>
      <div className="mb-4">
        <h1 className="page-title">Academic profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          {searchParams.onboarding
            ? "Welcome! Tell us about your background — you can save a partial profile and return anytime. Only your full name is required."
            : "Everything here is optional except your name. This information personalizes researcher matching and email drafts — LetterDesk never assumes qualifications you have not entered."}
        </p>
      </div>
      <ProfileForm devToken={devToken} />
    </AppShell>
  );
}
