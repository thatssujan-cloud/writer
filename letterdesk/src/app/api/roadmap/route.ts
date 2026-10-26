import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { q, q1, run } from "@/lib/db";
import { roadmapTaskSchema, formatZodError } from "@/lib/validation";

export const runtime = "nodejs";

const DEFAULT_TASKS = [
  "Research and shortlist universities",
  "Identify suitable supervisors",
  "Read key publications of target researchers",
  "Contact relevant professors",
  "Prepare CV and statement of purpose",
  "Arrange recommendation letters",
  "Check language-test requirements",
  "Verify admission and scholarship deadlines on official pages",
  "Prepare transcripts and supporting documents",
  "Submit applications",
  "Track application results",
  "Prepare for interviews",
];

export async function GET(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  // Seed default checklist once per user (no invented dates — due dates are user-set only).
  const count = q1<{ n: number }>("SELECT COUNT(*) as n FROM roadmap_tasks WHERE user_id=@uid", { uid: s.userId });
  if (!count || Number(count.n) === 0) {
    for (const t of DEFAULT_TASKS) {
      run(`INSERT INTO roadmap_tasks (user_id, title, source) VALUES (@uid,@t,'template')`, { uid: s.userId, t });
    }
  }
  const rows = q<any>("SELECT * FROM roadmap_tasks WHERE user_id=@uid ORDER BY done ASC, (due_date IS NULL) ASC, due_date ASC, id ASC", { uid: s.userId });
  return NextResponse.json({ tasks: rows });
}

export async function POST(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = roadmapTaskSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", fields: formatZodError(parsed.error) }, { status: 400 });
  const d = parsed.data;
  const info = run(
    `INSERT INTO roadmap_tasks (user_id, title, due_date, linked_to, source) VALUES (@uid,@title,@due,@link,'user')`,
    { uid: s.userId, title: d.title, due: d.dueDate || null, link: d.linkedTo || null }
  );
  return NextResponse.json({ ok: true, id: Number(info.lastInsertRowid) }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid task id." }, { status: 400 });
  const owned = q1<{ id: number }>("SELECT id FROM roadmap_tasks WHERE id=@id AND user_id=@uid", { id, uid: s.userId });
  if (!owned) return NextResponse.json({ error: "Task not found or not yours." }, { status: 404 });
  const sets: string[] = [];
  const params: Record<string, unknown> = { id, uid: s.userId };
  if (typeof body?.done === "boolean") { sets.push("done = @done"); params.done = body.done ? 1 : 0; }
  if (typeof body?.title === "string" && body.title.trim()) { sets.push("title = @title"); params.title = body.title.trim().slice(0, 200); }
  if ("dueDate" in (body ?? {})) { sets.push("due_date = @due"); params.due = body.dueDate ? String(body.dueDate).slice(0, 30) : null; }
  if ("linkedTo" in (body ?? {})) { sets.push("linked_to = @link"); params.link = body.linkedTo ? String(body.linkedTo).slice(0, 200) : null; }
  if (!sets.length) return NextResponse.json({ ok: true, changed: 0 });
  run(`UPDATE roadmap_tasks SET ${sets.join(", ")} WHERE id=@id AND user_id=@uid`, params);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id)) return NextResponse.json({ error: "Invalid task id." }, { status: 400 });
  const owned = q1<{ id: number }>("SELECT id FROM roadmap_tasks WHERE id=@id AND user_id=@uid", { id, uid: s.userId });
  if (!owned) return NextResponse.json({ error: "Task not found or not yours." }, { status: 404 });
  run(`DELETE FROM roadmap_tasks WHERE id=@id AND user_id=@uid`, { id, uid: s.userId });
  return NextResponse.json({ ok: true });
}
