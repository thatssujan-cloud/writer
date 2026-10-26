"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorNote, Spinner, StatusBadge, Toast } from "@/components/ui";

const STATUSES = ["saved", "preparing", "contacted", "no_reply", "replied_positive", "replied_negative", "interview", "declined", "accepted", "closed"] as const;
const STATUS_LABELS: Record<string, string> = {
  saved: "Saved only — not yet contacted",
  preparing: "Preparing to contact",
  contacted: "Contacted (I sent it)",
  no_reply: "No reply yet",
  replied_positive: "Positive reply",
  replied_negative: "Declined / not interested",
  interview: "Interview / discussion",
  declined: "Declined my application",
  accepted: "Accepted!",
  closed: "Closed / withdrawn",
};

interface RecordRow {
  id: number; researcher_id: string; researcher_name: string; institution: string | null; topic: string | null;
  contact_email: string | null; email_source: string | null; status: string; contacted_at: string | null;
  follow_up_date: string | null; last_response_at: string | null; next_action: string | null; notes: string | null;
}

export default function TrackerClient() {
  const [records, setRecords] = useState<RecordRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(null), 2500); };

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/outreach");
      const data = await res.json();
      if (res.status === 401) { window.location.href = "/login?next=/tracker"; return; }
      if (!res.ok) throw new Error(data.error ?? "Could not load your outreach records.");
      setRecords(data.records as RecordRow[]);
    } catch (e: any) { setError(e.message ?? "Network error loading records."); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function startEdit(r: RecordRow) {
    setEditing(r.id);
    setForm({
      status: r.status, notes: r.notes ?? "", nextAction: r.next_action ?? "",
      contactedAt: r.contacted_at ?? "", followUpDate: r.follow_up_date ?? "", lastResponseAt: r.last_response_at ?? "",
      contactEmail: r.contact_email ?? "", emailSource: r.email_source ?? "",
    });
  }

  async function saveEdit() {
    setSaving(true);
    try {
      const res = await fetch("/api/outreach", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed.");
      showToast("Record updated.");
      setEditing(null);
      void load();
    } catch (e: any) { showToast(e.message ?? "Could not update record."); }
    finally { setSaving(false); }
  }

  async function remove(id: number) {
    const res = await fetch(`/api/outreach?id=${id}`, { method: "DELETE" });
    if (res.ok) { showToast("Record deleted."); setConfirmDelete(null); void load(); }
    else showToast("Delete failed — retry.");
  }

  const shown = (records ?? []).filter((r) => filter === "all" || r.status === filter);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="pb-10">
      <Toast toast={toast} />
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Outreach tracker</h1>
          <p className="mt-1 text-sm text-slate-600">
            You log what actually happened — LetterDesk never sends emails and never marks a message as sent on its own. Follow-up reminders below are based on dates you entered.
          </p>
        </div>
        <Link href="/discovery" className="btn-primary">Find researchers</Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <label htmlFor="flt" className="font-medium text-slate-600">Filter:</label>
        <select id="flt" className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All statuses ({records?.length ?? "…"})</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {!records && !error && <div className="py-10 text-center"><Spinner label="Loading your records…" /></div>}
      {error && <ErrorNote message={error} onRetry={() => void load()} />}
      {records && records.length === 0 && (
        <EmptyState title="No outreach records yet"
          body="Records appear here when you save a researcher’s profile or log contact from Email Studio. Trackers reflect only actions you confirmed."
          action={<Link href="/discovery" className="btn-primary">Discover researchers</Link>} />
      )}

      {shown.length > 0 && (
        <div className="overflow-x-auto card">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Researcher</th><th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Contacted</th><th className="px-4 py-3">Follow-up</th>
                <th className="px-4 py-3">Next action</th><th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const overdueFollowUp = r.follow_up_date && r.follow_up_date <= today && (r.status === "contacted" || r.status === "no_reply");
                return (
                  <tr key={r.id} className="border-b border-slate-100 align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#0f2447]">{r.researcher_name}</p>
                      <p className="text-xs text-slate-500">{[r.institution, r.topic].filter(Boolean).join(" · ")}</p>
                      {r.contact_email && <p className="mt-0.5 break-all text-xs text-slate-500">{r.contact_email}{r.email_source ? ` (${r.email_source})` : ""}</p>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.contacted_at ?? "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {r.follow_up_date ? (overdueFollowUp ? <span className="badge-amber">due {r.follow_up_date}</span> : r.follow_up_date) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.next_action ?? (r.notes ? r.notes.slice(0, 60) : "—")}</td>
                    <td className="px-4 py-3 text-right">
                      {editing === r.id ? (
                        <button className="btn-secondary" onClick={() => setEditing(null)}>Close</button>
                      ) : (
                        <>
                          <button className="btn-ghost" onClick={() => startEdit(r)}>Update</button>{" "}
                          <button className="btn-ghost text-red-700 hover:bg-red-50" onClick={() => setConfirmDelete(r.id)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {shown.length === 0 && records && records.length > 0 && (
        <p className="card p-6 text-sm text-slate-500">No records match this filter.</p>
      )}

      {editing !== null && records && (
        <section className="card mt-5 p-5">
          <h2 className="section-title">Update record — {records.find((r) => r.id === editing)?.researcher_name}</h2>
          <p className="mt-1 text-xs text-slate-500">Only change fields that reflect reality. “Contacted” should be set by you, after you personally sent the email.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label" htmlFor="st">Status</label>
              <select id="st" className="input" value={form.status ?? ""} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div><label className="label" htmlFor="ca">Date I contacted (you fill after sending)</label>
              <input id="ca" type="date" className="input" value={form.contactedAt ?? ""} onChange={(e) => setForm({ ...form, contactedAt: e.target.value })} /></div>
            <div><label className="label" htmlFor="fu">Follow-up date</label>
              <input id="fu" type="date" className="input" value={form.followUpDate ?? ""} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} /></div>
            <div><label className="label" htmlFor="lr">Last reply date</label>
              <input id="lr" type="date" className="input" value={form.lastResponseAt ?? ""} onChange={(e) => setForm({ ...form, lastResponseAt: e.target.value })} /></div>
            <div><label className="label" htmlFor="na">Next action</label>
              <input id="na" className="input" value={form.nextAction ?? ""} onChange={(e) => setForm({ ...form, nextAction: e.target.value })} placeholder="e.g. Send polite follow-up" /></div>
            <div><label className="label" htmlFor="ce">Contact email used</label>
              <input id="ce" className="input" value={form.contactEmail ?? ""} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="label" htmlFor="nt">Notes (private)</label>
              <textarea id="nt" rows={3} className="input" value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="What they said, what you promised to send, where you found their address…" />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn-primary" disabled={saving} onClick={() => void saveEdit()}>{saving ? "Saving…" : "Save changes"}</button>
            <button className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </section>
      )}

      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card max-w-sm p-5">
            <h3 className="section-title">Delete this record?</h3>
            <p className="mt-2 text-sm text-slate-600">This permanently removes the outreach record from your account. Your drafts and saved researchers are unaffected.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>Keep it</button>
              <button className="btn-danger" onClick={() => void remove(confirmDelete)}>Delete record</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
