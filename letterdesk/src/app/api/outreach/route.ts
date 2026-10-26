import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { q, q1, run } from "@/lib/db";
import { outreachCreateSchema, outreachUpdateSchema, formatZodError } from "@/lib/validation";
import type { OutreachStatus } from "@/lib/types";

export const runtime = "nodejs";

const VALID_STATUSES: OutreachStatus[] = [
  "to_research","saved","drafting","ready_to_contact","contacted","follow_up_due",
  "replied","meeting","application_in_progress","offer_received","closed",
];

export async function GET(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") ?? "";
  const search = (sp.get("q") ?? "").trim().toLowerCase();
  let rows = q<any>(
    `SELECT * FROM outreach_records WHERE user_id = @uid ORDER BY updated_at DESC`, { uid: s.userId });
  if (status && VALID_STATUSES.includes(status as OutreachStatus)) rows = rows.filter((r) => r.status === status);
  if (search) {
    rows = rows.filter((r) =>
      [r.researcher_name, r.institution, r.topic, r.notes, r.next_action]
        .filter(Boolean).join(" ").toLowerCase().includes(search));
  }
  return NextResponse.json({ records: rows });
}

export async function POST(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = outreachCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", fields: formatZodError(parsed.error) }, { status: 400 });
  }
  const d = parsed.data;
  const status: OutreachStatus = VALID_STATUSES.includes(d.status as OutreachStatus) ? (d.status as OutreachStatus) : "saved";
  // Duplicate prevention: UNIQUE(user_id, researcher_id) — upsert instead of error.
  run(
    `INSERT INTO outreach_records
       (user_id, researcher_id, researcher_name, institution, topic, contact_email, email_source, status, notes)
     VALUES (@uid,@rid,@rn,@inst,@topic,@email,@esrc,@status,@notes)
     ON CONFLICT(user_id, researcher_id) DO UPDATE SET
       researcher_name=excluded.researcher_name, institution=excluded.institution, topic=excluded.topic,
       email_source=COALESCE(NULLIF(excluded.email_source,''), outreach_records.email_source),
       notes=COALESCE(NULLIF(excluded.notes,''), outreach_records.notes),
       updated_at=datetime('now')`,
    { uid: s.userId, rid: d.researcherId, rn: d.researcherName, inst: d.institution || null, topic: d.topic || null,
      email: d.email || null, esrc: d.emailSource || null, status, notes: d.notes || null }
  );
  const rec = q1<{ id: number }>(
    "SELECT id FROM outreach_records WHERE user_id = @uid AND researcher_id = @rid",
    { uid: s.userId, rid: d.researcherId });
  return NextResponse.json({ ok: true, id: rec?.id }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid record id." }, { status: 400 });
  const parsed = outreachUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", fields: formatZodError(parsed.error) }, { status: 400 });
  const owned = q1<{ id: number }>("SELECT id FROM outreach_records WHERE id=@id AND user_id=@uid", { id, uid: s.userId });
  if (!owned) return NextResponse.json({ error: "Record not found or not yours." }, { status: 404 });
  const d = parsed.data;
  if (d.status && !VALID_STATUSES.includes(d.status as OutreachStatus)) {
    return NextResponse.json({ error: "Unknown status value." }, { status: 400 });
  }
  const sets: string[] = [];
  const params: Record<string, unknown> = { id, uid: s.userId };
  for (const key of ["status", "notes", "followUpDate", "contactedAt", "lastResponseAt", "nextAction", "messageSnapshot"] as const) {
    if (d[key] !== undefined) {
      const col = { status: "status", notes: "notes", followUpDate: "follow_up_date", contactedAt: "contacted_at",
        lastResponseAt: "last_response_at", nextAction: "next_action", messageSnapshot: "message_snapshot" }[key];
      sets.push(`${col} = @${key}`);
      params[key] = d[key];
    }
  }
  if (sets.length === 0) return NextResponse.json({ ok: true, changed: 0 });
  run(`UPDATE outreach_records SET ${sets.join(", ")}, updated_at=datetime('now') WHERE id=@id AND user_id=@uid`, params);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid record id." }, { status: 400 });
  const owned = q1<{ id: number }>("SELECT id FROM outreach_records WHERE id=@id AND user_id=@uid", { id, uid: s.userId });
  if (!owned) return NextResponse.json({ error: "Record not found or not yours." }, { status: 404 });
  run(`DELETE FROM outreach_records WHERE id=@id AND user_id=@uid`, { id, uid: s.userId });
  return NextResponse.json({ ok: true });
}
