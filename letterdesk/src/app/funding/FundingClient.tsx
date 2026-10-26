"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorNote, Spinner, StatusBadge, Toast } from "@/components/ui";
import type { FundingOpportunity, OpportunityCategory } from "@/lib/types";
import { SAMPLE_OPPORTUNITIES, OFFICIAL_SEARCH_LINKS } from "@/lib/sample-data";

const CATEGORIES: { id: OpportunityCategory | ""; label: string }[] = [
  { id: "", label: "All categories" },
  { id: "RA", label: "Research assistantship (RA)" },
  { id: "TA", label: "Teaching assistantship (TA)" },
  { id: "graduate_position", label: "Graduate position" },
  { id: "funded_phd", label: "Funded PhD position" },
  { id: "university_scholarship", label: "University scholarship" },
  { id: "external_fellowship", label: "External fellowship" },
  { id: "grant_project", label: "Grant / project funding" },
  { id: "doctoral_program", label: "Doctoral program" },
];

const VERIF_LABEL: Record<FundingOpportunity["verification"], string> = {
  verified_current: "Verified current on official page",
  official_unconfirmed: "Official page — details unconfirmed",
  historical: "Historical listing (may have closed)",
  estimated_window: "Estimated window only",
  generic_guidance: "Generic guidance",
  no_information: "No information found",
};

const VERIF_CLS: Record<FundingOpportunity["verification"], string> = {
  verified_current: "badge-green",
  official_unconfirmed: "badge-blue",
  historical: "badge-amber",
  estimated_window: "badge-amber",
  generic_guidance: "badge-slate",
  no_information: "badge-red",
};

export default function FundingClient() {
  const [saved, setSaved] = useState<{ id: string; payload: FundingOpportunity; savedAt: string }[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // filters
  const [category, setCategory] = useState<OpportunityCategory | "">("");
  const [level, setLevel] = useState<"any" | "masters" | "phd" | "both">("any");
  const [country, setCountry] = useState("");
  const [field, setField] = useState("");
  const [selfFunded, setSelfFunded] = useState(false);
  const [showHistorical, setShowHistorical] = useState(false);

  // lookup
  const [lookupUrl, setLookupUrl] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState<any | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const showToast = useCallback((t: string) => { setToast(t); setTimeout(() => setToast(null), 2600); }, []);

  const loadSaved = useCallback(async () => {
    setLoadingList(true); setListError(null);
    try {
      const res = await fetch("/api/opportunities");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load your saved opportunities.");
      setSaved(data.saved as any);
    } catch (e: any) {
      if (e.message === "Failed to fetch") setListError("Network error loading saved opportunities.");
      else setListError(e.message);
    } finally { setLoadingList(false); }
  }, []);

  useEffect(() => { void loadSaved(); }, [loadSaved]);

  const pool = useMemo(() => {
    let items = SAMPLE_OPPORTUNITIES.filter((o) => showHistorical || o.verification !== "historical");
    if (category) items = items.filter((o) => o.category === category);
    if (level !== "any") items = items.filter((o) => o.degreeLevel === level || o.degreeLevel === "both");
    if (country.trim()) items = items.filter((o) => (o.country ?? "").toLowerCase().includes(country.trim().toLowerCase()));
    if (field.trim()) items = items.filter((o) => (o.field ?? "").toLowerCase().includes(field.trim().toLowerCase()));
    return items;
  }, [category, level, country, field, showHistorical]);

  async function toggleSave(o: FundingOpportunity) {
    const isSaved = saved.some((s) => s.id === o.id);
    try {
      const res = isSaved
        ? await fetch(`/api/opportunities?id=${encodeURIComponent(o.id)}`, { method: "DELETE" })
        : await fetch("/api/opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: o.id, payload: JSON.stringify(o) }) });
      if (!res.ok) throw new Error();
      setSaved((s) => isSaved ? s.filter((x) => x.id !== o.id) : [{ id: o.id, payload: o, savedAt: new Date().toISOString() }, ...s]);
      showToast(isSaved ? "Removed from your shortlist." : "Added to your shortlist.");
    } catch { showToast("Save failed — please retry."); }
  }

  async function runLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupBusy(true); setLookupError(null); setLookupResult(null);
    try {
      const res = await fetch("/api/opportunities/lookup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: lookupUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed.");
      setLookupResult(data);
      if (data.status === "no_information") showToast("The helper could not read that page — record what you see on the official page manually in your tracker notes.");
    } catch (err: any) { setLookupError(err.message ?? "Unexpected lookup error."); }
    finally { setLookupBusy(false); }
  }

  return (
    <div className="pb-10">
      <Toast toast={toast} />
      <div className="mb-5">
        <h1 className="page-title">Funding Center</h1>
        <p className="mt-1 text-sm text-slate-600">
          LetterDesk does <strong>not</strong> fabricate scholarships or deadlines. This area shows clearly-marked sample guidance records, official search portals, and a page-inspection helper you can point at any URL you found yourself. Deadlines you enter are yours alone.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card p-4">
            <h2 className="section-title">Browse sample guidance records</h2>
            <p className="mt-1 text-xs text-slate-500">Illustrative, fictionalized cards marked “Sample data”. Use them to understand what fields matter — always confirm real programs on their official pages.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="label" htmlFor="cat">Category</label>
                <select id="cat" className="input" value={category} onChange={(e) => setCategory(e.target.value as any)}>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="lvl">Degree level</label>
                <select id="lvl" className="input" value={level} onChange={(e) => setLevel(e.target.value as any)}>
                  <option value="any">Any</option><option value="masters">Master&apos;s</option><option value="phd">PhD</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ctry">Country</label>
                <input id="ctry" className="input" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. DE" />
              </div>
              <div>
                <label className="label" htmlFor="fld">Field / topic</label>
                <input id="fld" className="input" value={field} onChange={(e) => setField(e.target.value)} placeholder="e.g. engineering" />
              </div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={selfFunded} onChange={(e) => setSelfFunded(e.target.checked)} disabled />
              Self-funded pathway (informational — filter applies to your own tracked opportunities)
            </label>
            <label className="mt-1 flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={showHistorical} onChange={(e) => setShowHistorical(e.target.checked)} />
              Include historical listings (marked “may have closed”)
            </label>

            <div className="mt-4 space-y-4">
              {pool.length === 0 && <EmptyState title="No sample records match" body="Relax the filters — this demo library is intentionally small because LetterDesk refuses to auto-generate opportunity lists." />}
              {pool.map((o) => {
                const isSaved = saved.some((s) => s.id === o.id);
                return (
                  <article key={o.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-semibold text-[#0f2447]">{o.title}</h3>
                      <span className={`${VERIF_CLS[o.verification]} shrink-0`}>{VERIF_LABEL[o.verification]}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{o.provider} · {CATEGORIES.find((c) => c.id === o.category)?.label ?? o.category} · {o.degreeLevel} · {o.country}</p>
                    <dl className="mt-2 space-y-1 text-sm text-slate-700">
                      <div><dt className="inline font-medium">Funding: </dt><dd className="inline">{o.fundingDetails}</dd></div>
                      <div><dt className="inline font-medium">Eligibility: </dt><dd className="inline">{o.eligibility}</dd></div>
                      <div><dt className="inline font-medium">Deadline: </dt><dd className="inline">
                        {o.deadline
                          ? <>{o.deadline}{o.deadlineIsEstimated ? <span className="text-amber-700"> (estimated window — verify on the official page)</span> : ""}</>
                          : <StatusBadge status="no_information" />}
                      </dd></div>
                      <div><dt className="inline font-medium">Start: </dt><dd className="inline">{o.startDate ?? "Unknown"}</dd></div>
                    </dl>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <a href={o.url} target="_blank" rel="noreferrer" className="link">Open source page ↗</a>
                      <span className="text-slate-400">Last checked by provider: {o.lastChecked}</span>
                      <button onClick={() => void toggleSave(o)} className={isSaved ? "btn-secondary ml-auto" : "btn-primary ml-auto"}>
                        {isSaved ? "★ Shortlisted" : "☆ Add to my shortlist"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="card p-4">
            <h2 className="section-title">Opportunity page inspection helper</h2>
            <p className="mt-1 text-xs text-slate-500">Paste the URL of an official funding/admission page you found. The server reads it and reports honestly what it could and could not determine — it never guesses deadlines.</p>
            <form onSubmit={runLookup} className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input className="input flex-1" value={lookupUrl} onChange={(e) => setLookupUrl(e.target.value)}
                placeholder="https://university.edu/graduate-funding" aria-label="Page URL to inspect" required />
              <button className="btn-primary shrink-0" disabled={lookupBusy}>{lookupBusy ? "Reading page…" : "Inspect page"}</button>
            </form>
            {lookupError && <div className="mt-3"><ErrorNote message={lookupError} /></div>}
            {lookupResult && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-semibold">{VERIF_LABEL[(lookupResult.status ?? "no_information") as keyof typeof VERIF_LABEL] ?? lookupResult.status}</p>
                <p className="mt-1 text-slate-700">{lookupResult.detail}</p>
                {lookupResult.caveat && <p className="mt-1 text-xs italic text-slate-500">{lookupResult.caveat}</p>}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="card p-4">
            <h2 className="section-title">My shortlist ({saved.length})</h2>
            {loadingList && <Spinner label="Loading…" />}
            {listError && <ErrorNote message={listError} onRetry={() => void loadSaved()} />}
            {!loadingList && saved.length === 0 && <p className="mt-2 text-sm text-slate-500">Nothing shortlisted yet.</p>}
            <ul className="mt-2 space-y-2">
              {saved.map((s) => (
                <li key={s.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{s.payload.title}</span>
                    <button className="btn-ghost px-1 text-xs text-red-700" onClick={() => void toggleSave(s.payload)}>Remove</button>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">Shortlisted {s.savedAt.slice(0, 10)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-4">
            <h2 className="section-title">Official search portals</h2>
            <p className="mt-1 text-xs text-slate-500">Start real searches here — these are the authoritative sources for most international graduate funding.</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {OFFICIAL_SEARCH_LINKS.map((l) => (
                <li key={l.url}><a className="link" href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a></li>
              ))}
            </ul>
          </section>

          <section className="card border-amber-200 bg-amber-50 p-4">
            <h2 className="section-title">Honesty rules</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">
              <li>No invented scholarships, amounts, or deadlines — ever.</li>
              <li>“Estimated” means a typical recurring window, not a confirmed date.</li>
              <li>“No information found” is a valid, shown result.</li>
              <li>Always verify final figures and dates on the official page before applying.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
