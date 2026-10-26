import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { reviewDraft } from "@/lib/review";

export const runtime = "nodejs";

// Editorial checklist over the current draft text. Runs locally — no AI provider needed.
export async function POST(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const out = reviewDraft({
    subject: String(body.subject ?? "").slice(0, 300),
    body: String(body.body ?? "").slice(0, 20000),
    professorName: String(body.professorName ?? "").slice(0, 200),
    studentName: String(body.studentName ?? "").slice(0, 120),
    hasResearchConnection: !!body.hasResearchConnection,
    contactEmail: String(body.contactEmail ?? "").slice(0, 254),
  });
  return NextResponse.json(out);
}
