"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, ErrorNote, Spinner, StatusBadge, Toast } from "@/components/ui";
import type { MatchResult, Researcher } from "@/lib/types";
import { BAND_LABELS } from "@/lib/matching";

export default function ResearcherDetailClient({ id }: { id: string }) {
  const [data, setData] = useState<{ researcher: Researcher; match: MatchResult; saved: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [morePubs, setMorePubs] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/researcher/${encodeURIComponent(id)}`);
      const json = await res.json();
      if (res.status === 401) { window.location.href = `/login?next=/researcher/${encodeURIComponent(id)}`; return; }
      if (!res.ok) throw new Error(json.error ?? `Could not load this researcher (HTTP ${res.status}).`);
      setData(json);
    } catch (e: any) {
      setError(e.message ?? "Network error while loading the researcher record.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function toggleSave() {
    if (!data) return;
    setSaving(true);
    try {
      const res = data.saved
        ? await fetch(`/api/researcher/${encodeURIComponent(id)}`, { method: "DELETE" })
        : await fetch(`/api/researcher/${encodeURIComponent(id)}/save`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payload: JSON.stringify(data.researcher) }),
          });
      if (!res.ok) throw new Error();
      setData({ ...data, saved: !data.saved });
      setToast(data.saved ? "Removed from saved researchers." : "Researcher saved.");
      setTimeout(() => setToast(null), 2500);
    } catch {
      setToast("Save action failed — please retry.");
      setTimeout(() => setToast(null), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="py-16 text-center"><Spinner label="Loading source records…" /></div>;
  if (error) return <div><ErrorNote message={error} onRetry={() => void load()} /><Link href="/discovery" className="btn-ghost mt-4">← Back to discovery</Link></div>;
  if (!data) return null;

  const r = data.researcher;
  const m = data.match;
  const pubs = morePubs ? r.publications : r.publications.slice(0, 8);

  return (
    <div className="pb-10">
      <Toast toast={toast} />
      <Link href="/discovery" className="text-sm text-indigo-700 hover:underline">← Back to discovery</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{r.name}</h1>
          <p className="mt-1 text-slate-600">{[r.department, r.institution].filter(Boolean).join(" · ") || "Institution not listed in source record"}{r.country ? ` · ${r.country}` : ""}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {r.source === "sample" && <StatusBadge status="sample" />}
            <span className="badge-slate">Source: {r.source === "openalex" ? "OpenAlex (verified scholarly catalog)" : "fictional sample record"}</span>
            <span className="badge-slate">Retrieved {new Date(r.retrievedAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void toggleSave()} disabled={saving} className={data.saved ? "btn-secondary" : "btn-primary"}>
            {saving ? "Working…" : data.saved ? "★ Saved — remove" : "☆ Save researcher"}
          </button>
          <Link href={`/email-studio?researcher=${encodeURIComponent(r.id)}`} className="btn-primary">Draft email</Link>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <section className="card p-5">
            <h2 className="section-title">Research profile</h2>
            {r.topics.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">{r.topics.map((t) => <span key={t} className="chip">{t}</span>)}</div>
            ) : <p className="mt-2 text-sm text-slate-500">No topics listed in the source record.</p>}
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-slate-500">Works indexed</dt><dd className="font-semibold text-slate-800">{r.worksCount ?? "Unknown"}</dd></div>
              <div><dt className="text-slate-500">Citations</dt><dd className="font-semibold text-slate-800">{r.citedByCount?.toLocaleString() ?? "Unknown"}</dd></div>
              <div><dt className="text-slate-500">Country</dt><dd className="font-semibold text-slate-800">{r.country ?? "Unknown"}</dd></div>
            </dl>
            {r.profileUrl && (
              <a href={r.profileUrl} target="_blank" rel="noreferrer" className="link mt-3 inline-block text-sm">
                Official OpenAlex author record ↗
              </a>
            )}
          </section>

          <section className="card p-5">
            <h2 className="section-title">Recent publications (from source)</h2>
            {r.publications.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No publications were retrievable for this record. Nothing has been invented — you can retry loading them below.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {pubs.map((p, i) => (
                  <li key={i} className="border-l-2 border-indigo-200 pl-3 text-sm">
                    {p.url ? <a className="font-medium text-slate-800 hover:text-indigo-700 hover:underline" href={p.url} target="_blank" rel="noreferrer">{p.title}</a>
                           : <span className="font-medium text-slate-800">{p.title}</span>}
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[p.year, p.venue, p.doi ? `DOI: ${p.doi}` : null, p.citedBy != null ? `${p.citedBy} citations` : null]
                        .filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {r.publications.length > 8 && (
              <button className="btn-ghost mt-3 px-2 text-indigo-700" onClick={() => setMorePubs((v) => !v)}>
                {morePubs ? "Show fewer" : `Show all ${r.publications.length}`}
              </button>
            )}
          </section>

          <section className="card p-5">
            <h2 className="section-title">Student–research alignment</h2>
            <p className="mt-1 text-xs text-slate-500">
              Internal keyword-overlap heuristic against your academic profile — a matching aid only, <strong>not</strong> a probability of admission or of receiving a reply.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${m.band === "strong" ? "bg-green-600" : m.band === "partial" ? "bg-amber-500" : "bg-slate-400"}`}
                     style={{ width: `${m.score}%` }} aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold text-slate-700">{m.score}/100 · {BAND_LABELS[m.band]}</span>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {m.dimensions.map((d) => (
                <li key={d.label} className="flex items-start gap-2">
                  <span className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${d.score >= 0.5 ? "bg-green-500" : d.score > 0 ? "bg-amber-400" : "bg-slate-300"}`} />
                  <span><strong>{d.label}:</strong> <span className="text-slate-600">{d.detail}</span></span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-5">
          <section className="card p-5">
            <h2 className="section-title">Contact information</h2>
            {r.email ? (
              <>
                <p className="mt-2 break-all font-medium text-slate-800">{r.email}</p>
                <p className="mt-1"><StatusBadge status={r.emailStatus} /></p>
                <p className="mt-2 text-xs text-slate-500">LetterDesk only displays addresses present in credible source records — never guessed patterns. Confirm on the official department page before relying on it.</p>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-600">
                No address is listed in the source record.{" "}
                <StatusBadge status="missing" />
              </p>
              <p className="mt-2 text-xs text-slate-500">Find the official contact on the university’s faculty directory, then add it manually in the Outreach Tracker with its source noted.</p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="section-title">Potential next steps</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-slate-700">
              {r.publications[0] && <li>Read “{r.publications[0].title}” before writing — mention one concrete takeaway.</li>}
              {r.topics[0] && <li>Prepare a specific question about their work on {r.topics[0]} and how it connects to your experience.</li>}
              <li>Check whether their group currently takes students on their official lab/department page (group size and openings are rarely in bibliographic records).</li>
              <li><Link href={`/email-studio?researcher=${encodeURIComponent(r.id)}`} className="link">Create personalized outreach</Link> in Email Studio.</li>
              <li>Add this researcher to your <Link href="/tracker" className="link">Outreach Tracker</Link> once you prepare to contact them.</li>
            </ul>
          </section>

          <section className="card p-5">
            <h2 className="section-title">Sources &amp; honesty</h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Name, institution, topics, counts and publications come from the OpenAlex open catalog ({r.source === "sample" ? "this is a fictional demo record" : `record ${r.id.replace("openalex:", "A")}`}).
              Funding availability, student openings and email addresses are <em>not</em> part of bibliographic data and are shown as unknown unless sourced.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
