import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { q, q1 } from "@/lib/db";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

const PROFILE_FIELDS = [
  "fullName", "currentUniversity", "currentDegree", "fieldOfStudy", "intendedDegree",
  "targetCountries", "intendedIntake", "researchInterests", "thesisExperience",
  "workExperience", "skills", "achievements", "languageTest",
] as const;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso.includes("T") || iso.includes(":") ? iso : iso + "T00:00:00Z");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function DashboardPage() {
  const session = getSessionFromCookies();
  if (!session) redirect("/login?next=/dashboard");
  const uid = session.userId;
  const user = q1<{ name: string }>("SELECT name FROM users WHERE id=@id", { id: uid });

  const profRow = q1<{ data: string }>("SELECT data FROM academic_profiles WHERE user_id=@uid", { uid });
  let profileComplete = 0;
  if (profRow) {
    try {
      const p = JSON.parse(profRow.data) as Record<string, unknown>;
      profileComplete = PROFILE_FIELDS.filter((f) => {
        const v = p[f];
        return Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim().length > 0 : v != null;
      }).length;
    } catch { /* ignore */ }
  }
  const pct = Math.round((profileComplete / PROFILE_FIELDS.length) * 100);

  const savedResearchers = q1<{ n: number }>("SELECT COUNT(*) n FROM saved_researchers WHERE user_id=@uid", { uid })?.n ?? 0;
  const savedOpps = q1<{ n: number }>("SELECT COUNT(*) n FROM saved_opportunities WHERE user_id=@uid", { uid })?.n ?? 0;
  const drafts = q<{ id: number; researcher_name: string | null; subject: string; status: string; updated_at: string }>(
    "SELECT id, researcher_name, subject, status, updated_at FROM email_drafts WHERE user_id=@uid ORDER BY updated_at DESC LIMIT 5", { uid });
  const draftsAwaiting = q1<{ n: number }>(
    "SELECT COUNT(*) n FROM email_drafts WHERE user_id=@uid AND status='draft'", { uid })?.n ?? 0;
  const contacted = q1<{ n: number }>(
    "SELECT COUNT(*) n FROM outreach_records WHERE user_id=@uid AND contacted_at IS NOT NULL", { uid })?.n ?? 0;
  const today = new Date().toISOString().slice(0, 10);
  const followUps = q<{ id: number; researcher_name: string; follow_up_date: string | null }>(
    `SELECT id, researcher_name, follow_up_date FROM outreach_records
     WHERE user_id=@uid AND follow_up_date IS NOT NULL AND status IN ('contacted','follow_up_due')
     AND follow_up_date <= @today ORDER BY follow_up_date ASC LIMIT 5`, { uid, today });
  const deadlines = q<{ id: number; title: string; due_date: string | null; done: number }>(
    `SELECT id, title, due_date, done FROM roadmap_tasks
     WHERE user_id=@uid AND done=0 AND due_date IS NOT NULL AND due_date >= @today
     ORDER BY due_date ASC LIMIT 5`, { uid, today });
  const overdue = q<{ id: number; title: string; due_date: string | null }>(
    `SELECT id, title, due_date FROM roadmap_tasks
     WHERE user_id=@uid AND done=0 AND due_date IS NOT NULL AND due_date < @today
     ORDER BY due_date ASC LIMIT 5`, { uid, today });
  const recentOutreach = q<{ researcher_name: string; institution: string | null; status: string; updated_at: string }>(
    "SELECT researcher_name, institution, status, updated_at FROM outreach_records WHERE user_id=@uid ORDER BY updated_at DESC LIMIT 5", { uid });

  const isNew = !profRow && Number(savedResearchers) === 0 && drafts.length === 0;

  return (
    <AppShell user={{ name: user?.name ?? "Student", email: session.email }}>
      <div className="mb-6">
        <h1 className="page-title">Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</h1>
        <p className="mt-1 text-sm text-slate-600">Your graduate research, funding &amp; outreach overview. All counts below come from your real activity in LetterDesk.</p>
      </div>

      {isNew && (
        <div className="card mb-6 border-indigo-200 bg-indigo-50/50 p-5">
          <h2 className="section-title">Get started</h2>
          <p className="mt-1 text-sm text-slate-700">Three quick steps set up everything else: build your academic profile, discover researchers that fit it, then draft outreach in Email Studio.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/profile?onboarding=1" className="btn-primary">1 · Build academic profile</Link>
            <Link href="/discovery" className="btn-secondary">2 · Discover researchers</Link>
            <Link href="/email-studio" className="btn-secondary">3 · Draft an email</Link>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Academic profile</p>
          <p className="mt-1 text-2xl font-bold text-[#0f2447]">{pct}%</p>
          <p className="mt-1 text-xs text-slate-500">Fields completed ({profileComplete}/{PROFILE_FIELDS.length}). A fuller profile improves matching and drafts.</p>
          <Link href="/profile" className="btn-ghost mt-2 px-2 text-indigo-700">{profRow ? "Edit profile →" : "Complete profile →"}</Link>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Saved researchers</p>
          <p className="mt-1 text-2xl font-bold text-[#0f2447]">{savedResearchers}</p>
          <p className="mt-1 text-xs text-slate-500">Researchers you bookmarked from discovery.</p>
          <Link href="/discovery?saved=1" className="btn-ghost mt-2 px-2 text-indigo-700">View list →</Link>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Drafts awaiting review</p>
          <p className="mt-1 text-2xl font-bold text-[#0f2447]">{draftsAwaiting}</p>
          <p className="mt-1 text-xs text-slate-500">Email drafts still in “draft” state — nothing is ever marked sent automatically.</p>
          <Link href="/email-studio" className="btn-ghost mt-2 px-2 text-indigo-700">Open Email Studio →</Link>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Contacts logged</p>
          <p className="mt-1 text-2xl font-bold text-[#0f2447]">{contacted}</p>
          <p className="mt-1 text-xs text-slate-500">Outreach records you confirmed as contacted.</p>
          <Link href="/tracker" className="btn-ghost mt-2 px-2 text-indigo-700">Open tracker →</Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Follow-ups due</h2>
            <Link href="/tracker" className="text-xs font-medium text-indigo-700 hover:underline">Manage in tracker</Link>
          </div>
          {followUps.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Nothing due today. Follow-up reminders appear here when a contact’s follow-up date arrives (default suggestion: 7–10 days after contact).</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {followUps.map((f) => (
                <li key={f.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                  <span className="font-medium text-amber-900">{f.researcher_name}</span>
                  <span className="text-xs text-amber-800">due {fmtDate(f.follow_up_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Upcoming deadlines</h2>
            <Link href="/roadmap" className="text-xs font-medium text-indigo-700 hover:underline">Roadmap</Link>
          </div>
          {overdue.length > 0 && (
            <ul className="mt-3 space-y-2">
              {overdue.map((t) => (
                <li key={`od-${t.id}`} className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm">
                  <span className="font-medium text-red-900">{t.title}</span>
                  <span className="text-xs text-red-800">overdue · {fmtDate(t.due_date)}</span>
                </li>
              ))}
            </ul>
          )}
          {deadlines.length === 0 && overdue.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No dated tasks yet. Deadlines you enter yourself appear here — LetterDesk never invents them.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {deadlines.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span className="font-medium text-slate-800">{t.title}</span>
                  <span className="text-xs text-slate-500">{fmtDate(t.due_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Recent drafts</h2>
            <Link href="/email-studio" className="text-xs font-medium text-indigo-700 hover:underline">New draft</Link>
          </div>
          {drafts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No drafts yet. Pick a saved researcher in Email Studio to generate one.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {drafts.map((d) => (
                <li key={d.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-slate-800">{d.subject || "(no subject)"}</span>
                    <span className="shrink-0 text-xs capitalize text-slate-500">{d.status.replace("_", " ")}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{d.researcher_name ?? "General"} · updated {fmtDate(d.updated_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Recent activity</h2>
            <Link href="/funding" className="text-xs font-medium text-indigo-700 hover:underline">{savedOpps} saved opportunit{savedOpps === 1 ? "y" : "ies"}</Link>
          </div>
          {recentOutreach.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No outreach records yet. Save a researcher and create a record from the tracker or their profile page.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentOutreach.map((r, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <span className="truncate font-medium text-slate-800">{r.researcher_name}{r.institution ? ` — ${r.institution}` : ""}</span>
                  <span className="shrink-0 text-xs capitalize text-slate-500">{r.status.replace(/_/g, " ")}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
