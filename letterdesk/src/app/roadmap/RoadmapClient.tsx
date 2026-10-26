"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Spinner, ErrorNote, EmptyState, Toast } from "@/components/ui";

interface Task { id: number; title: string; done: number; due_date: string | null; linked_to: string | null; source: string; created_at: string }

const today = () => new Date().toISOString().slice(0, 10);

export default function RoadmapClient() {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [link, setLink] = useState("");
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/roadmap");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load your roadmap.");
      setTasks(data.tasks ?? []);
    } catch (e: any) { setError(String(e.message ?? "Network error — please retry.")); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  async function toggle(t: Task) {
    const res = await fetch("/api/roadmap", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: t.id, done: !t.done }),
    });
    if (res.ok) { setTasks((ts) => ts ? ts.map((x) => x.id === t.id ? { ...x, done: t.done ? 0 : 1 } : x) : ts); flash(t.done ? "Task marked incomplete." : "Task completed ✔"); }
    else { const d = await res.json().catch(() => ({})); flash(d.error ?? "Could not update task."); }
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) { setFormError("Task title is required."); return; }
    setAdding(true);
    const res = await fetch("/api/roadmap", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), dueDate: due || "", linkedTo: link.trim() || "" }),
    });
    const data = await res.json().catch(() => ({}));
    setAdding(false);
    if (res.ok) { setTitle(""); setDue(""); setLink(""); await load(); flash("Task added."); }
    else setFormError(data.fields?.title ?? data.error ?? "Could not add task.");
  }

  async function remove(t: Task) {
    if (!confirm(`Delete task “${t.title}”? This cannot be undone.`)) return;
    const res = await fetch(`/api/roadmap?id=${t.id}`, { method: "DELETE" });
    if (res.ok) { setTasks((ts) => ts ? ts.filter((x) => x.id !== t.id) : ts); flash("Task deleted."); }
    else flash("Could not delete task.");
  }

  const { overdue, upcoming, doneCount } = useMemo(() => {
    const list = tasks ?? [];
    const t = today();
    return {
      overdue: list.filter((x) => !x.done && x.due_date && x.due_date < t),
      upcoming: list.filter((x) => !x.done && x.due_date && x.due_date >= t).slice(0, 5),
      doneCount: list.filter((x) => x.done).length,
    };
  }, [tasks]);

  return (
    <div>
      <Toast toast={toast} />
      <p className="mt-1 text-sm text-slate-600">A practical checklist for your graduate applications. Due dates are ones you set yourself — LetterDesk never invents deadlines. Progress is saved on the server and stays after reloads.</p>

      {error && <div className="mt-4"><ErrorNote message={error} onRetry={() => void load()} /></div>}
      {!error && !tasks && <div className="mt-8"><Spinner label="Loading your roadmap…" /></div>}

      {tasks && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="card p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Completed</p><p className="mt-1 text-2xl font-bold text-green-700">{doneCount}<span className="text-sm font-normal text-slate-500"> / {tasks.length}</span></p></div>
            <div className="card p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Overdue</p><p className={`mt-1 text-2xl font-bold ${overdue.length ? "text-red-600" : "text-slate-700"}`}>{overdue.length}</p></div>
            <div className="card p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Next dated task</p><p className="mt-1 text-2xl font-bold text-amber-600">{upcoming.length ? upcoming[0].due_date : "—"}</p><p className="text-xs text-slate-500">{upcoming.length ? upcoming[0].title : "No dated tasks yet"}</p></div>
          </div>

          <form onSubmit={addTask} className="card mt-5 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <div>
              <label className="label" htmlFor="rt-title">New custom task</label>
              <input id="rt-title" className="input" placeholder="e.g. Email transcript request to registrar" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
              {formError && <p className="field-error">{formError}</p>}
            </div>
            <div>
              <label className="label" htmlFor="rt-due">Due date (optional)</label>
              <input id="rt-due" type="date" className="input" value={due} min="2000-01-01" onChange={(e) => setDue(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="rt-link">Linked to (optional)</label>
              <input id="rt-link" className="input" placeholder="University / professor" value={link} onChange={(e) => setLink(e.target.value)} maxLength={200} />
            </div>
            <button type="submit" disabled={adding} className="btn-primary">{adding ? "Adding…" : "Add task"}</button>
          </form>

          {tasks.length === 0 ? (
            <div className="mt-6"><EmptyState title="No tasks yet" body="Your checklist will appear here once seeded, or add a custom task above." /></div>
          ) : (
            <ul className="mt-5 space-y-2">
              {tasks.map((t) => {
                const isOverdue = !t.done && t.due_date && t.due_date < today();
                return (
                  <li key={t.id} className={`card flex items-start gap-3 p-4 ${isOverdue ? "border-red-300 bg-red-50/40" : ""}`}>
                    <input type="checkbox" checked={!!t.done} onChange={() => void toggle(t)} aria-label={`Mark "${t.title}" ${t.done ? "incomplete" : "complete"}`} className="mt-1 h-4 w-4 accent-indigo-700" />
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-medium ${t.done ? "text-slate-400 line-through" : "text-slate-800"}`}>{t.title}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                        {t.due_date && <span className={isOverdue ? "font-semibold text-red-600" : ""}>{isOverdue ? "⚠ Overdue — " : "Due "}{t.due_date}</span>}
                        {t.linked_to && <span>Linked: {t.linked_to}</span>}
                        <span>{t.source === "template" ? "Default checklist item" : "Your custom task"}</span>
                      </p>
                    </div>
                    <button onClick={() => void remove(t)} className="btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50" aria-label={`Delete task ${t.title}`}>Delete</button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
