"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorNote, Spinner, StatusBadge } from "@/components/ui";
import type { MatchResult, Researcher } from "@/lib/types";

interface SavedRow {
  researcher_id: string;
  payload: string;
  saved_at: string;
}

export default function DiscoveryClient({ initialSaved = false }: { initialSaved?: boolean }) {
  const [tab, setTab] = useState<"search" | "saved">(initialSaved ? "saved" : "search");

  // ---- search state ----
  const [q, setQ] = useState("");
  const [institution, setInstitution] = useState("");
  const [country, setCountry] = useState("");
  const [demo, setDemo] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Researcher[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [matchInfo, setMatchInfo] = useState<Record<string, MatchResult>>({});
  const [profileMissing, setProfileMissing] = useState(false);

  // ---- saved state ----
  const [saved, setSaved] = useState<SavedRow[] | null>(null);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);

  const loadSaved = useCallback(async () => {
    setSavedLoading(true);
    setSavedError(null);
    try {
      const res = await fetch("/api/saved-researchers");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load saved researchers.");
      setSaved(data.researchers as SavedRow[]);
    } catch (e: any) {
      if (e.message === "AUTH") window.location.href = "/login?next=/discovery";
      else setSavedError(e.message ?? "Network error.");
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "saved" && saved === null) void loadSaved();
  }, [tab, saved, loadSaved]);

  async function runSearch(p = 1) {
    setLoading(true);
    setError(null);
    setPage(p);
    setResults(null);
    setMatchInfo({});
    try {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      if (institution.trim()) sp.set("institution", institution.trim());
      if (country.trim()) sp.set("country", country.trim());
      if (demo) sp.set("demo", "1");
      sp.set("page", String(p));
      const res = await fetch(`/api/researchers/search?${sp.toString()}`);
      const data = await res.json();
      if (res.status === 401) { window.location.href = "/login?next=/discovery"; return; }
      if (!res.ok) throw new Error(data.error ?? `Search failed (HTTP ${res.status}).`);
      setResults(data.results as Researcher[]);
      setTotal(data.total ?? data.results.length);
      setPages(data.pages ?? 1);
      setProfileMissing(!!data.noProfile);
      // Attach match results returned by the server (computed from the user's profile).
      if (Array.isArray(data.results)) {
        const m: Record<string, MatchResult> = {};
        for (const r of data.results as (Researcher & { match?: MatchResult })[]) {
          if (r.match) m[r.id] = r.match;
        }
        setMatchInfo(m);
      }
    } catch (e: any) {
      setError(e.message ?? "Unexpected error during search.");
    } finally {
      setLoading(false);
    }
  }

  const canSearch = q.trim() || institution.trim() || demo;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Researcher discovery</h1>
          <p className="mt-1 text-sm text-slate-600">
            Live results come from <a className="link" href="https://openalex.org" target="_blank" rel="noreferrer">OpenAlex</a>, an open scholarly catalog. LetterDesk never invents researchers, publications, or contact details.
          </p>
        </div>
        <div role="tablist" aria-label="Discovery views" className="flex rounded-lg border border-slate-200 bg-white p-1 text-sm">
          <button role="tab" aria-selected={tab === "search"} onClick={() => setTab("search")}
            className={`rounded-md px-3 py-1.5 ${tab === "search" ? "bg-indigo-600 font-semibold text-white" : "text-slate-600"}`}>Search</button>
          <button role="tab" aria-selected={tab === "saved"} onClick={() => setTab("saved")}
            className={`rounded-md px-3 py-1.5 ${tab === "saved" ? "bg-indigo-600 font-semibold text-white" : "text-slate-600"}`}>
            Saved{saved ? ` (${saved.length})` : ""}
          </button>
        </div>
      </div>

      {tab === "search" && (
        <>
          <form
            className="card mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5"
            onSubmit={(e) => { e.preventDefault(); void runSearch(1); }}
          >
            <div className="lg:col-span-2">
              <label htmlFor="dq" className="label">Name, topic, publication, method or skill</label>
              <input id="dq" className="input" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder='e.g. "graph neural networks" or "Jane Smith"' />
            </div>
            <div>
              <label htmlFor="di" className="label">University / institution</label>
              <input id="di" className="input" value={institution} onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g. University of Toronto" />
            </div>
            <div>
              <label htmlFor="dc" className="label">Country filter</label>
              <input id="dc" className="input" value={country} onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. Canada" />
            </div>
            <div className="flex items-end gap-2">
              <button type="submit" disabled={loading || !canSearch} className="btn-primary flex-1">
                {loading ? "Searching…" : "Search"}
              </button>
            </div>
            <div className="sm:col-span-2 lg:col-span-5 flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
                Demo mode — browse clearly-marked fictional sample records instead of live data
              </label>
              {!canSearch && <span>Enter a search term or enable demo mode.</span>}
            </div>
          </form>

          {profileMissing && results && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Your academic profile is empty, so relevance explanations are limited.{" "}
              <Link href="/profile" className="font-semibold underline">Complete your profile</Link> to see personalized matching.
            </div>
          )}

          {error && <div className="mb-4"><ErrorNote message={error} onRetry={() => void runSearch(page)} /></div>}
          {loading && <div className="py-10 text-center"><Spinner label="Querying OpenAlex…" /></div>}

          {!loading && results && results.length === 0 && (
            <EmptyState
              title="No researchers matched this search"
              body="OpenAlex returned no records for these terms. Try broader keywords, remove the country filter, or check spelling of the name/institution."
            />
          )}

          {!loading && results && results.length > 0 && (
            <>
              <p className="mb-3 text-sm text-slate-600">
                Showing {results.length} of ~{total.toLocaleString()} source records · page {page}/{pages}.
              </p>
              <ul className="space-y-4">
                {results.map((r) => (
                  <ResearcherCard key={r.id} r={r} match={matchInfo[r.id]} />
                ))}
              </ul>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button className="btn-secondary" disabled={page <= 1 || loading} onClick={() => void runSearch(page - 1)}>← Previous</button>
                <span className="text-sm text-slate-600">Page {page} of {pages}</span>
                <button className="btn-secondary" disabled={page >= pages || loading} onClick={() => void runSearch(page + 1)}>Next →</button>
              </div>
            </>
          )}

          {!loading && !results && !error && (
            <EmptyState
              title="Start with a research topic"
              body="Search by topic (“battery solid electrolytes”), a professor’s name, an institution, a methodology (“density functional theory”), or a tool (“PyTorch”). Results include publications straight from OpenAlex records."
            />
          )}
        </>
      )}

      {tab === "saved" && (
        <>
          {savedLoading && <div className="py-10 text-center"><Spinner label="Loading your saved researchers…" /></div>}
          {savedError && <ErrorNote message={savedError} onRetry={() => void loadSaved()} />}
          {saved && saved.length === 0 && !savedLoading && (
            <EmptyState title="No saved researchers yet"
              body="Bookmark researchers from search results or their profile pages and they will appear here."
              action={<button className="btn-primary" onClick={() => setTab("search")}>Search researchers</button>} />
          )}
          {saved && saved.length > 0 && (
            <ul className="space-y-4">
              {saved.map((row) => {
                let r: Researcher | null = null;
                try { r = JSON.parse(row.payload); } catch { /* skip broken */ }
                if (!r) return null;
                return (
                  <li key={row.researcher_id}>
                    <ResearcherCard r={r} match={null} savedAt={row.saved_at}
                      onUnsave={async () => {
                        await fetch(`/api/saved-researchers?id=${encodeURIComponent(row.researcher_id)}`, { method: "DELETE" });
                        void loadSaved();
                      }} />
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

export function ResearcherCard({ r, match, savedAt, onUnsave }: {
  r: Researcher;
  match: MatchResult | null;
  savedAt?: string;
  onUnsave?: () => void;
}) {
  const bandCls = useMemo(() => ({
    strong: "badge-green", partial: "badge-amber", limited: "badge-slate",
  }[match?.band ?? "limited"]), [match]);

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-[#0f2447]">
            <Link href={`/researcher/${encodeURIComponent(r.id)}`} className="hover:underline">{r.name}</Link>
          </h3>
          <p className="text-sm text-slate-600">
            {[r.department, r.institution].filter(Boolean).join(" · ") || "Institution not listed in source record"}
            {r.country ? `, ${r.country}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {r.source === "sample" && <StatusBadge status="sample" />}
          {match && (
            <span className={`${bandCls} normal-case`} title="Internal keyword-matching heuristic — not an admission probability">
              fit {match.score}/100
            </span>
          )}
        </div>
      </div>

      {r.topics.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {r.topics.slice(0, 6).map((t) => <span key={t} className="chip">{t}</span>)}
        </div>
      )}

      {r.publications.length > 0 && (
        <div className="mt-3 text-sm">
          <p className="font-medium text-slate-700">Recent works (from source):</p>
          <ul className="mt-1 space-y-1">
            {r.publications.slice(0, 2).map((p, i) => (
              <li key={i} className="text-slate-600">
                {p.url ? <a className="link" href={p.url} target="_blank" rel="noreferrer">{p.title}</a> : p.title}
                {p.year ? ` · ${p.year}` : ""}{p.doi ? ` · DOI ${p.doi}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {match && match.dimensions.length > 0 && (
        <details className="mt-3 text-sm text-slate-600">
          <summary className="cursor-pointer font-medium text-indigo-700">Why this matched your profile</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {match.dimensions.map((d) => <li key={d.label}><strong>{d.label}:</strong> {d.detail}</li>)}
          </ul>
          <p className="mt-1 text-xs italic">Fit score is an internal keyword-overlap aid (0–100), not a probability of admission.</p>
        </details>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={`/researcher/${encodeURIComponent(r.id)}`} className="btn-secondary">View profile</Link>
        <Link href={`/email-studio?researcher=${encodeURIComponent(r.id)}`} className="btn-secondary">Draft email</Link>
        {savedAt ? (
          <>
            <span className="text-xs text-slate-500">Saved {savedAt.slice(0, 10)}</span>
            {onUnsave && <button onClick={onUnsave} className="btn-ghost text-red-700 hover:bg-red-50">Remove</button>}
          </>
        ) : (
          <SaveButton id={r.id} r={r} />
        )}
        <span className="ml-auto text-xs text-slate-400">Retrieved {r.retrievedAt.slice(0, 10)} · source: {r.source}</span>
      </div>
    </div>
  );
}

function SaveButton({ id, r }: { id: string; r: Researcher }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  async function save() {
    setState("saving");
    try {
      const res = await fetch(`/api/researcher/${encodeURIComponent(id)}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: JSON.stringify(r) }),
      });
      setState(res.ok ? "saved" : "error");
    } catch { setState("error"); }
  }
  if (state === "saved") return <span className="badge-green">Saved ✓</span>;
  return (
    <button onClick={() => void save()} disabled={state === "saving"} className="btn-primary">
      {state === "saving" ? "Saving…" : state === "error" ? "Retry save" : "Save researcher"}
    </button>
  );
}
