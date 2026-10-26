import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { q } from "@/lib/db";

export const runtime = "nodejs";

// Export all user-owned records as JSON download.
export async function GET(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const uid = s.userId;
  const profile = q("SELECT data, cv_filename, updated_at FROM academic_profiles WHERE user_id=@uid", { uid });
  const researchers = q("SELECT researcher_id, payload, saved_at FROM saved_researchers WHERE user_id=@uid", { uid });
  const opportunities = q("SELECT opportunity_id, payload, saved_at FROM saved_opportunities WHERE user_id=@uid", { uid });
  const drafts = q("SELECT id, researcher_name, mode, subject, body, status, created_at, updated_at FROM email_drafts WHERE user_id=@uid", { uid });
  const outreach = q("SELECT * FROM outreach_records WHERE user_id=@uid", { uid });
  const tasks = q("SELECT id, title, due_date, linked_to, done, source, created_at FROM roadmap_tasks WHERE user_id=@uid", { uid });
  const exportObj = {
    exportedAt: new Date().toISOString(),
    account: { email: s.email },
    academicProfile: profile.map((p) => ({ ...JSON.parse(String(p.data)), cvFilename: p.cv_filename, updatedAt: p.updated_at })),
    savedResearchers: researchers.map((r) => ({ id: r.researcher_id, savedAt: r.saved_at, record: JSON.parse(String(r.payload)) })),
    savedOpportunities: opportunities.map((o) => ({ id: o.opportunity_id, savedAt: o.saved_at, record: JSON.parse(String(o.payload)) })),
    emailDrafts: drafts,
    outreachRecords: outreach,
    roadmapTasks: tasks,
  };
  return new NextResponse(JSON.stringify(exportObj, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="letterdesk-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
