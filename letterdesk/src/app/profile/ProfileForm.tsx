"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Toast, Spinner } from "@/components/ui";

interface ProfileData { [k: string]: unknown }

const FIELDS: { key: string; label: string; type?: string; hint?: string; list?: boolean; area?: boolean; opts?: string[] }[] = [
  { key: "fullName", label: "Full name", hint: "Required — used in email greetings/signatures." },
  { key: "currentUniversity", label: "Current or previous university" },
  { key: "currentDegree", label: "Current degree", hint: "e.g. BSc (final year), MSc (graduated)." },
  { key: "fieldOfStudy", label: "Field of study", hint: "e.g. Civil Engineering, Microbiology." },
  { key: "intendedDegree", label: "Intended degree", opts: ["undecided", "masters", "phd"] },
  { key: "targetCountries", label: "Target countries", list: true, hint: "Comma-separated, e.g. Canada, Germany, USA." },
  { key: "targetUniversities", label: "Target universities", list: true, hint: "Optional — comma-separated." },
  { key: "intendedIntake", label: "Intended intake & start year", hint: "e.g. Fall 2027, Spring 2028." },
  { key: "researchInterests", label: "Research interests", list: true, hint: "Comma-separated topics, e.g. machine learning, carbon capture." },
  { key: "thesisExperience", label: "Thesis / research experience", area: true, hint: "What you studied, methods you used, results you can honestly claim." },
  { key: "workExperience", label: "Relevant employment or field experience", area: true },
  { key: "skills", label: "Technical skills, tools & methods", list: true, hint: "Comma-separated, e.g. Python, HPLC, ANSYS, literature review." },
  { key: "achievements", label: "Publications, projects & achievements", area: true, hint: "Only real ones — these may be quoted in drafts." },
  { key: "gpa", label: "GPA / academic performance (optional)", hint: "e.g. 3.7/4.0. Leave blank if not comfortable sharing." },
  { key: "languageTest", label: "Language test status (optional)", hint: "e.g. IELTS 7.0 (2026), planned for Dec 2026." },
  { key: "cvLink", label: "CV link (optional)", hint: "A public URL (e.g. LinkedIn/GitHub page). Or upload a file below." },
  { key: "fundingNotes", label: "Funding preference & constraints (optional)", area: true, hint: "e.g. need RA/TA funding; self-funded master's possible for one year." },
];

export default function ProfileForm({ devToken }: { devToken?: string | null }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [cvName, setCvName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const hdrs = useRef<Record<string, string>>(devToken ? { Cookie: `ld_session=${devToken}` } : {});

  async function load() {
    setLoading(true); setLoadError(null);
    try {
      const res = await fetch("/api/profile", { headers: hdrs.current });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const p = data.profile ?? {};
      const v: Record<string, string> = {};
      for (const f of FIELDS) {
        const val = p[f.key];
        v[f.key] = Array.isArray(val) ? val.join(", ") : String(val ?? "");
      }
      setValues(v);
      setCvName(data.cvFilename ?? null);
    } catch {
      setLoadError("Could not load your saved profile. Check your connection and retry.");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function set(key: string, val: string) { setValues((v) => ({ ...v, [key]: val })); }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true); setErrors({});
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...hdrs.current },
        body: JSON.stringify(values),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setToast("Profile saved.");
        setTimeout(() => { setToast(null); router.refresh(); }, 700);
      } else if (data.fields) {
        setErrors(data.fields);
        setToast(null);
      } else {
        setToast(`Save failed: ${data.error ?? "server error"}`);
      }
    } catch {
      setToast("Save failed — network error. Your text is still here; try again.");
    } finally { setSaving(false); }
  }

  async function uploadCv(file: File) {
    if (file.size > 5 * 1024 * 1024) { setToast("File exceeds the 5 MB limit."); return; }
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    if (!["pdf", "doc", "docx"].includes(ext)) { setToast("Only PDF, DOC or DOCX files are accepted."); return; }
    const fd = new FormData();
    fd.append("cv", file);
    const res = await fetch("/api/cv", { method: "POST", body: fd, headers: hdrs.current });
    const data = await res.json().catch(() => ({}));
    if (res.ok) { setCvName(data.filename); setToast("CV uploaded. It is stored privately on the server — it is never sent to AI services or made public."); }
    else setToast(data.error ?? "Upload failed.");
    setTimeout(() => setToast(null), 4000);
  }

  async function removeCv() {
    await fetch("/api/cv", { method: "DELETE", headers: hdrs.current });
    setCvName(null); setToast("CV removed.");
    setTimeout(() => setToast(null), 2500);
  }

  async function deleteProfile() {
    if (!confirm("Delete your entire academic profile? Researcher matches will fall back to no-evidence mode. This cannot be undone.")) return;
    await fetch("/api/profile", { method: "DELETE", headers: hdrs.current });
    setValues({}); setCvName(null);
    setToast("Profile deleted.");
    setTimeout(() => setToast(null), 2500);
    router.refresh();
  }

  // completion %
  const filled = FIELDS.filter((f) => (values[f.key] ?? "").trim() !== "" || (f.key === "cvFile" && cvName)).length;
  const pct = Math.round((filled / FIELDS.length) * 100);

  if (loading) return <div className="p-8"><Spinner label="Loading your profile…" /></div>;

  return (
    <div className="space-y-6">
      <Toast toast={toast} />
      <div className="card p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">Profile completeness</span>
          <span className="text-slate-500">{pct}%</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-2 rounded-full bg-indigo-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="hint">More detail improves matching quality. Optional fields stay optional.</p>
      </div>

      {loadError && (
        <div className="card flex items-center justify-between border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <span>{loadError}</span><button onClick={load} className="btn-secondary px-3 py-1">Retry</button>
        </div>
      )}

      <form onSubmit={save} className="card space-y-5 p-6" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className={f.area ? "sm:col-span-2" : ""}>
              <label htmlFor={f.key} className="label">{f.label}{f.key !== "fullName" && <span className="ml-1 font-normal text-slate-400">(optional)</span>}</label>
              {f.opts ? (
                <select id={f.key} className="input" value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)}>
                  <option value="">—</option>
                  {f.opts.map((o) => <option key={o} value={o}>{o === "masters" ? "Master's" : o === "phd" ? "PhD" : o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
                </select>
              ) : f.area ? (
                <textarea id={f.key} rows={3} className="input" value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
              ) : (
                <input id={f.key} type={f.key === "cvLink" ? "url" : "text"} className="input" value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
              )}
              {f.hint && <p className="hint">{f.hint}</p>}
              {errors[f.key] && <p className="field-error">{errors[f.key]}</p>}
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-dashed border-slate-300 p-4">
          <p className="label">CV upload (optional)</p>
          {cvName ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-slate-700">Stored privately: <code className="rounded bg-slate-100 px-1">{cvName}</code></span>
              <button type="button" onClick={removeCv} className="btn-secondary px-3 py-1 text-red-700">Remove</button>
            </div>
          ) : (
            <input type="file" accept=".pdf,.doc,.docx" aria-label="Upload CV"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCv(f); }} />
          )}
          <p className="hint">PDF/DOC/DOCX up to 5 MB. Files are kept on the LetterDesk server, never served publicly, and never forwarded to AI providers.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
          <button type="button" onClick={deleteProfile} className="btn-ghost text-red-700 hover:bg-red-50">Delete profile</button>
          <p className="text-xs text-slate-500">Saving a partial profile is fine — return anytime.</p>
        </div>
      </form>
    </div>
  );
}
