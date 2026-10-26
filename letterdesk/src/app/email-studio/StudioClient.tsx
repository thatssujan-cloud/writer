"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, ErrorNote, Spinner, StatusBadge, Toast } from "@/components/ui";
import { EMAIL_MODES, type EmailMode, type Researcher } from "@/lib/types";
import { checkSyntax } from "@/lib/email-check";

// ---- pure client-side helpers (kept here so tests can import them) ----

export function words(text: string): number {
  return text.split(/\s+/).filter((w) => /[\w]/.test(w)).length;
}

export function buildMailto(email: string, subject: string, body: string): string {
  const params = new URLSearchParams();
  if (subject) params.set("subject", subject);
  if (body) params.set("body", body);
  return `mailto:${encodeURIComponent(email.trim())}?${params.toString()}`;
}

interface StudioProps {
  researchers: (Researcher & { saved?: boolean })[];
  profile: Record<string, any> | null;
  draftId: number | null;
  preselect: string | null;
  aiConfigured: boolean;
}

type Engine = "template" | "ai";

export default function StudioClient({ researchers, profile, draftId, preselect, aiConfigured }: StudioProps) {
  const [selectedId, setSelectedId] = useState<string>(preselect && researchers.some((r) => r.id === preselect) ? preselect : "");
  const researcher = useMemo(() => researchers.find((r) => r.id === selectedId) ?? null, [researchers, selectedId]);

  // inputs
  const [mode, setMode] = useState<EmailMode["id"]>("ra_inquiry");
  const [tone, setTone] = useState<"formal" | "warm" | "direct">("formal");
  const [targetLength, setTargetLength] = useState<"short" | "standard">("short");
  const [engine, setEngine] = useState<Engine>("template");
  const [studentName, setStudentName] = useState(profile?.fullName ?? "");
  const [signature, setSignature] = useState(profile?.fullName ?? "");
  const [targetDegree, setTargetDegree] = useState<"masters" | "phd" | "undecided">(profile?.intendedDegree === "phd" || profile?.intendedDegree === "masters" ? profile.intendedDegree : "phd");
  const [intendedIntake, setIntendedIntake] = useState(profile?.intendedIntake ?? "");
  const [background, setBackground] = useState(
    profile?.currentDegree || profile?.fieldOfStudy
      ? `${profile.currentDegree ?? ""}${profile.currentDegree && profile.fieldOfStudy ? " in " : ""}${profile.fieldOfStudy ?? ""}${profile.currentUniversity ? ` at ${profile.currentUniversity}` : ""}`.trim()
      : ""
  );
  const [experience, setExperience] = useState(profile?.thesisExperience ?? profile?.workExperience ?? "");
  const [skills, setSkills] = useState((profile?.skills ?? []).slice(0, 2).join(", "));
  const [publicationTitle, setPublicationTitle] = useState("");
  const [publicationYear, setPublicationYear] = useState<string>("");
  const [opportunityType, setOpportunityType] = useState("");
  const [professorName, setProfessorName] = useState(researcher?.name ?? "");
  const [professorEmail, setProfessorEmail] = useState(researcher?.email ?? "");
  const [originalSummary, setOriginalSummary] = useState("");

  // output
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [history, setHistory] = useState<{ subject: string; body: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [savedDraftId, setSavedDraftId] = useState<number | null>(draftId);
  const [review, setReview] = useState<any | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [emailCheck, setEmailCheck] = useState<any | null>(null);
  const [checking, setChecking] = useState(false);
  const [contactedConfirm, setContactedConfirm] = useState(false);
  const initialLoadDone = useRef(false);

  const showToast = useCallback((t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // sync professor fields when researcher changes
  useEffect(() => {
    if (researcher) {
      setProfessorName(researcher.name);
      setProfessorEmail(researcher.email ?? "");
      if (researcher.publications[0]) {
        setPublicationTitle(researcher.publications[0].title);
        setPublicationYear(researcher.publications[0].year ? String(researcher.publications[0].year) : "");
      } else {
        setPublicationTitle("");
        setPublicationYear("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // load existing draft for editing
  useEffect(() => {
    if (!draftId || initialLoadDone.current) return;
    initialLoadDone.current = true;
    fetch("/api/drafts").then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const dr = d?.drafts?.find((x: any) => x.id === draftId);
        if (dr) {
          setSubject(dr.subject); setBodyText(dr.body);
          if (dr.researcher_id) setSelectedId(dr.researcher_id);
          if (dr.mode) setMode(dr.mode);
          showToast("Existing draft loaded — it remains editable and is not marked sent.");
        }
      }).catch(() => undefined);
  }, [draftId, showToast]);

  const syntax = useMemo(() => (professorEmail ? checkSyntax(professorEmail) : null), [professorEmail]);

  async function callGenerate(instruction: string) {
    setBusy(true);
    setGenError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engine, instruction, mode, tone, targetLength,
          studentName, signature, targetDegree, intendedIntake,
          professorName, professorEmail, institution: researcher?.institution ?? "",
          background, experience, publicationTitle,
          publicationYear: publicationYear ? Number(publicationYear) : null,
          topics: researcher?.topics ?? [],
          skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
          opportunityType,
          originalMessageSummary: mode === "follow_up" ? originalSummary : undefined,
          currentBody: bodyText,
          subject,
        }),
      });
      const data = await res.json();
      if (res.status === 401) { window.location.href = "/login?next=/email-studio"; return; }
      if (!res.ok) throw new Error(data.error ?? "Generation failed.");
      if (bodyText) setHistory((h) => [...h.slice(-9), { subject, body: bodyText }]);
      setSubject(data.subject ?? subject);
      setBodyText(data.body ?? bodyText);
      setNotes([...(data.notes ?? []), ...(data.fallbackReason ? [data.fallbackReason] : [])]);
      setReview(null);
    } catch (e: any) {
      setGenError(e.message ?? "Unexpected error while generating.");
    } finally {
      setBusy(false);
    }
  }

  function undo() {
    const prev = history[history.length - 1];
    if (!prev) { showToast("Nothing to undo."); return; }
    setHistory((h) => h.slice(0, -1));
    setSubject(prev.subject);
    setBodyText(prev.body);
    showToast("Reverted to previous version.");
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied to clipboard.`);
    } catch {
      showToast("Clipboard unavailable in this browser — select the text manually.");
    }
  }

  function download() {
    const blob = new Blob([`Subject: ${subject}\n\n${bodyText}`], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `letterdesk-draft-${(professorName || "email").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast("Draft downloaded as a text file.");
  }

  async function saveDraft() {
    const payload = {
      id: savedDraftId ?? undefined,
      researcherId: researcher?.id ?? "", researcherName: professorName, mode, subject, body: bodyText,
    };
    try {
      const res = savedDraftId
        ? await fetch("/api/drafts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/drafts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      setSavedDraftId(savedDraftId ?? data.id);
      showToast("Draft saved. It stays in “draft” state until you confirm contact yourself.");
    } catch (e: any) {
      showToast(e.message ?? "Could not save draft — check your connection and retry.");
    }
  }

  async function runReview() {
    setReviewing(true);
    try {
      const res = await fetch("/api/review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject, body: bodyText, professorName, studentName,
          hasResearchConnection: !!publicationTitle || !!(researcher?.topics?.length),
          contactEmail: professorEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Review failed.");
      setReview(data);
    } catch (e: any) { showToast(e.message ?? "Review request failed."); }
    finally { setReviewing(false); }
  }

  async function verifyEmail() {
    setChecking(true);
    setEmailCheck(null);
    try {
      const res = await fetch("/api/email-check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: professorEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Verification failed.");
      setEmailCheck(data);
    } catch (e: any) { showToast(e.message ?? "Email verification request failed."); }
    finally { setChecking(false); }
  }

  async function markContacted() {
    if (!researcher || !contactedConfirm) return;
    try {
      // create/update outreach record via tracker API
      const listRes = await fetch("/api/outreach");
      const list = await listRes.json();
      const existing = list.records?.find((x: any) => x.researcher_id === researcher.id);
      const followUp = new Date(Date.now() + 8 * 864e5).toISOString().slice(0, 10);
      let res;
      if (existing) {
        res = await fetch("/api/outreach", { method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: existing.id, status: "contacted", contactedAt: new Date().toISOString().slice(0, 10), followUpDate: followUp, messageSnapshot: bodyText }) });
      } else {
        res = await fetch("/api/outreach", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ researcherId: researcher.id, researcherName: professorName, institution: researcher.institution ?? "", topic: researcher.topics[0] ?? "", email: professorEmail, status: "contacted" }) });
        if (res.ok) {
          const created = await fetch("/api/outreach").then((r) => r.json());
          const rec = created.records?.find((x: any) => x.researcher_id === researcher.id);
          if (rec) await fetch("/api/outreach", { method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: rec.id, contactedAt: new Date().toISOString().slice(0, 10), followUpDate: followUp, messageSnapshot: bodyText }) });
        }
      }
      if (res.ok) showToast("Marked as contacted in your Outreach Tracker (you confirmed this — LetterDesk never sends or auto-marks emails).");
      else showToast("Could not update the tracker — open the Tracker page to retry.");
    } catch { showToast("Tracker update failed — network error."); }
  }

  const wc = words(bodyText);

  return (
    <div className="pb-12">
      <Toast toast={toast} />
      <div className="mb-5">
        <h1 className="page-title">Email Studio</h1>
        <p className="mt-1 text-sm text-slate-600">
          Draft evidence-based outreach. The template engine works fully offline from your profile and verified records; nothing is ever sent automatically.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* LEFT: inputs */}
        <div className="space-y-4 lg:col-span-2">
          <section className="card p-4">
            <h2 className="section-title">1 · Recipient</h2>
            {researchers.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">No saved researchers yet.{" "}
                <Link href="/discovery" className="link font-medium">Discover researchers</Link> and save them, or continue without one — the generator will use only what you type below.</p>
            ) : (
              <select aria-label="Select saved researcher" className="input mt-2" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                <option value="">— No saved researcher selected —</option>
                {researchers.map((r) => <option key={r.id} value={r.id}>{r.name}{r.institution ? ` (${r.institution})` : ""}</option>)}
              </select>
            )}
            {researcher && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                {researcher.source === "sample" && <StatusBadge status="sample" />}
                <span>{researcher.topics.slice(0, 3).join(" · ")}</span>
              </div>
            )}
            <div className="mt-3 grid gap-2">
              <div>
                <label className="label" htmlFor="pn">Professor name</label>
                <input id="pn" className="input" value={professorName} onChange={(e) => setProfessorName(e.target.value)} placeholder="e.g. Prof. Jane Miller" />
              </div>
              <div>
                <label className="label" htmlFor="pe">Contact email</label>
                <div className="flex gap-2">
                  <input id="pe" className="input" value={professorEmail} onChange={(e) => { setProfessorEmail(e.target.value); setEmailCheck(null); }} placeholder="from official source only" />
                  <button onClick={() => void verifyEmail()} disabled={!professorEmail || checking} className="btn-secondary shrink-0">{checking ? "Checking…" : "Verify"}</button>
                </div>
                {syntax && syntax.messages.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs text-amber-700">{syntax.messages.map((m, i) => <li key={i}>⚠ {m}</li>)}</ul>
                )}
                {emailCheck && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                    <p className="font-semibold">{emailCheck.label}</p>
                    {emailCheck.dns?.detail && <p className="mt-0.5">{emailCheck.dns.detail}</p>}
                    <p className="mt-1 italic text-slate-500">{emailCheck.caveat}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="card p-4">
            <h2 className="section-title">2 · Message settings</h2>
            <label className="label mt-2 block" htmlFor="em">Email type</label>
            <select id="em" className="input" value={mode} onChange={(e) => setMode(e.target.value as EmailMode["id"])}>
              {EMAIL_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <p className="mt-1 text-xs text-slate-500">{EMAIL_MODES.find((m) => m.id === mode)?.description}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label className="label" htmlFor="tn">Tone</label>
                <select id="tn" className="input" value={tone} onChange={(e) => setTone(e.target.value as any)}>
                  <option value="formal">Formal</option><option value="warm">Warm</option><option value="direct">Direct</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="tl">Target length</label>
                <select id="tl" className="input" value={targetLength} onChange={(e) => setTargetLength(e.target.value as any)}>
                  <option value="short">Short (~100–150 words)</option><option value="standard">Standard</option>
                </select>
              </div>
            </div>
            {mode === "follow_up" && (
              <div className="mt-3">
                <label className="label" htmlFor="os">What did your original email ask? (for context only)</label>
                <textarea id="os" className="input" rows={2} value={originalSummary} onChange={(e) => setOriginalSummary(e.target.value)}
                  placeholder="e.g. Asked about PhD openings for Fall 2027 in battery materials" />
              </div>
            )}
          </section>

          <section className="card p-4">
            <h2 className="section-title">3 · Your details (editable)</h2>
            <p className="mt-1 text-xs text-slate-500">Pre-filled from your academic profile. Only what appears here is used — LetterDesk never invents qualifications.</p>
            <div className="mt-2 grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                <div><label className="label" htmlFor="sn">Your name</label><input id="sn" className="input" value={studentName} onChange={(e) => setStudentName(e.target.value)} /></div>
                <div><label className="label" htmlFor="sg">Signature</label><input id="sg" className="input" value={signature} onChange={(e) => setSignature(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label" htmlFor="td">Target degree</label>
                  <select id="td" className="input" value={targetDegree} onChange={(e) => setTargetDegree(e.target.value as any)}>
                    <option value="phd">PhD</option><option value="masters">Master&apos;s</option><option value="undecided">Undecided</option>
                  </select>
                </div>
                <div><label className="label" htmlFor="ii">Intended intake</label><input id="ii" className="input" value={intendedIntake} onChange={(e) => setIntendedIntake(e.target.value)} placeholder="e.g. Fall 2027" /></div>
              </div>
              <div><label className="label" htmlFor="bg">Academic background</label>
                <textarea id="bg" rows={2} className="input" value={background} onChange={(e) => setBackground(e.target.value)} placeholder="e.g. MSc candidate in Environmental Engineering at X University" /></div>
              <div><label className="label" htmlFor="ex">Relevant research / work experience</label>
                <textarea id="ex" rows={2} className="input" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="One or two concrete, verifiable things" /></div>
              <div><label className="label" htmlFor="sk">1–2 genuinely relevant skills (comma separated)</label>
                <input id="sk" className="input" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="e.g. Python, SEM imaging" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2"><label className="label" htmlFor="pt">Specific publication you read</label>
                  <input id="pt" className="input" value={publicationTitle} onChange={(e) => setPublicationTitle(e.target.value)} /></div>
                <div><label className="label" htmlFor="py">Year</label>
                  <input id="py" className="input" value={publicationYear} onChange={(e) => setPublicationYear(e.target.value)} inputMode="numeric" /></div>
              </div>
              <div><label className="label" htmlFor="ot">Opportunity requested</label>
                <input id="ot" className="input" value={opportunityType} onChange={(e) => setOpportunityType(e.target.value)} placeholder="e.g. PhD position with RA funding, Fall 2027" /></div>
            </div>
            {!profile && (
              <p className="mt-2 text-xs text-amber-700">No academic profile saved yet — <Link href="/profile" className="underline font-medium">build one</Link> to auto-fill these fields.</p>
            )}
          </section>

          <section className="card p-4">
            <h2 className="section-title">4 · Generation engine</h2>
            <div className="mt-2 space-y-2 text-sm">
              <label className="flex items-start gap-2">
                <input type="radio" checked={engine === "template"} onChange={() => setEngine("template")} className="mt-1 accent-indigo-600" />
                <span><strong>Template engine (Mode A)</strong> — deterministic, works without any AI key. Recommended.<br /><span className="text-xs text-slate-500">Uses only the fields above.</span></span>
              </label>
              <label className={`flex items-start gap-2 ${!aiConfigured ? "opacity-70" : ""}`}>
                <input type="radio" checked={engine === "ai"} onChange={() => setEngine("ai")} className="mt-1 accent-indigo-600" />
                <span><strong>External AI provider (Mode B)</strong> — {aiConfigured ? "configured on this server." : "not configured on this server; selecting it falls back to the template engine with an explanation."}<br />
                  <span className="text-xs text-slate-500">Sends only the typed fields above (no uploaded documents, no full profile) to the configured provider.</span></span>
              </label>
            </div>
          </section>
        </div>

        {/* RIGHT: output */}
        <div className="space-y-4 lg:col-span-3">
          <section className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="section-title">Draft</h2>
              <div className="text-xs text-slate-500">{wc} words{wc > 0 && (wc <= 170 ? " · good length for first contact" : wc < 60 ? " · consider adding one concrete sentence" : " · professors skim — consider trimming")}</div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => void callGenerate("generate")} disabled={busy || !professorName} className="btn-primary">{busy ? "Working…" : "✦ Generate email"}</button>
              <button onClick={() => void callGenerate("generate")} disabled={busy || !bodyText || !professorName} className="btn-secondary">Regenerate</button>
              <button onClick={() => void callGenerate("natural")} disabled={busy || !bodyText} className="btn-secondary">More natural</button>
              <button onClick={() => void callGenerate("shorten")} disabled={busy || !bodyText} className="btn-secondary">Shorten</button>
              <button onClick={() => void callGenerate("tone")} disabled={busy || !bodyText} className="btn-secondary">Change tone</button>
              <button onClick={() => void callGenerate("connection")} disabled={busy || !bodyText} className="btn-secondary">Improve research link</button>
              <button onClick={() => void callGenerate("grammar")} disabled={busy || !bodyText} className="btn-secondary">Fix grammar</button>
              <button onClick={undo} disabled={history.length === 0} className="btn-ghost" title="Revert the last rewrite">↩ Undo</button>
            </div>
            {!professorName && <p className="mt-2 text-xs text-amber-700">Add a professor name to enable generation.</p>}
            {busy && <div className="mt-3"><Spinner label="Composing draft…" /></div>}
            {genError && <div className="mt-3"><ErrorNote message={genError} onRetry={() => void callGenerate("generate")} /></div>}
            {notes.length > 0 && (
              <ul className="mt-3 space-y-1 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs text-indigo-900">
                {notes.map((n, i) => <li key={i}>ℹ {n}</li>)}
              </ul>
            )}
            <div className="mt-3">
              <label className="label" htmlFor="subj">Subject line (fully editable)</label>
              <input id="subj" className="input" value={subject} onChange={(e) => { setSubject(e.target.value); setReview(null); }} placeholder="Generated after you click Generate" />
            </div>
            <div className="mt-2">
              <label className="label" htmlFor="msg">Message (fully editable)</label>
              <textarea id="msg" rows={14} className="input font-normal" value={bodyText}
                onChange={(e) => { setBodyText(e.target.value); setReview(null); }}
                placeholder="Your draft appears here. Edit freely before exporting or handing off." />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => void copy(subject, "Subject")} disabled={!subject} className="btn-secondary">Copy subject</button>
              <button onClick={() => void copy(bodyText, "Message")} disabled={!bodyText} className="btn-secondary">Copy message</button>
              <button onClick={download} disabled={!bodyText} className="btn-secondary">Download .txt</button>
              <a href={buildMailto(professorEmail, subject, bodyText)}
                 className={professorEmail && bodyText ? "btn-primary" : "btn-secondary pointer-events-none opacity-50"}
                 aria-disabled={!professorEmail || !bodyText}
                 title={professorEmail ? "Opens your own email app with this draft — you press Send there" : "Add a recipient email first"}>
                Open in email app ↗
              </a>
              <button onClick={() => void saveDraft()} disabled={!bodyText} className="btn-secondary">Save draft</button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              The mailto handoff opens <em>your own</em> email client; LetterDesk never sends anything. Saved drafts stay in “draft” state until you log contact yourself.
            </p>
          </section>

          <section className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="section-title">Smart review</h2>
              <button onClick={() => void runReview()} disabled={!bodyText || reviewing} className="btn-secondary">{reviewing ? "Reviewing…" : "Run editorial checklist"}</button>
            </div>
            <p className="mt-1 text-xs text-slate-500">Objective checks (word count, greeting…) are separated from advice. No tool can guarantee a reply.</p>
            {review && (
              <div className="mt-3">
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${review.score >= 75 ? "bg-green-600" : review.score >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${review.score}%` }} />
                  </div>
                  <span className="text-sm font-semibold">{review.score}/100 <span className="font-normal text-slate-500">(editorial heuristic)</span></span>
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  {review.items.map((it: any, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className={it.kind === "objective" ? (it.ok ? "text-green-600" : "text-red-600") : it.ok ? "text-green-600" : "text-amber-500"}>
                        {it.kind === "objective" ? (it.ok ? "✓" : "✗") : (it.ok ? "✓" : "!")}
                      </span>
                      <span><strong className={it.kind === "advice" ? "font-medium text-slate-700" : ""}>{it.label}</strong>{" "}
                        <span className="text-slate-600">{it.detail}</span>{" "}
                        <span className="text-[10px] uppercase tracking-wide text-slate-400">{it.kind}</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="card p-4">
            <h2 className="section-title">After you send</h2>
            <p className="mt-1 text-sm text-slate-600">LetterDesk cannot see whether your email app actually sent the message. If you did send it, confirm below to log it in your tracker with a suggested follow-up date (+8 days).</p>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-indigo-600" checked={contactedConfirm} onChange={(e) => setContactedConfirm(e.target.checked)} />
              I personally sent this email to {professorName || "the professor"}
            </label>
            <button onClick={() => void markContacted()} disabled={!contactedConfirm || !researcher || !bodyText} className="btn-primary mt-3">
              Log as contacted in tracker
            </button>
            {!researcher && <p className="mt-1 text-xs text-amber-700">Select a saved researcher (or add them in the Outreach Tracker) to log this contact.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
