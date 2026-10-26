"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Toast } from "@/components/ui";

export default function SettingsClient({ email }: { email: string }) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [savingPw, setSavingPw] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (pw.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    if (pw !== pw2) { setPwError("Passwords do not match."); return; }
    setSavingPw(true);
    const res = await fetch("/api/account", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }),
    });
    setSavingPw(false);
    if (res.ok) { setPw(""); setPw2(""); flash("Password updated."); }
    else { const d = await res.json().catch(() => ({})); setPwError(d.error ?? "Could not update password."); }
  }

  async function exportData() {
    setExporting(true);
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("Export failed — please sign in again.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `letterdesk-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      flash("Your data was exported as JSON.");
    } catch (e: any) { flash(String(e.message ?? "Export failed.")); }
    setExporting(false);
  }

  async function deleteAccount() {
    if (confirmText !== "DELETE") { flash("Type DELETE exactly to confirm account removal."); return; }
    setDeleting(true);
    const res = await fetch("/api/account?confirm=DELETE", { method: "DELETE" });
    setDeleting(false);
    if (res.ok) { router.push("/"); router.refresh(); }
    else { const d = await res.json().catch(() => ({})); flash(d.error ?? "Could not delete account."); }
  }

  return (
    <div className="max-w-3xl">
      <Toast toast={toast} />
      <h1 className="page-title">Settings</h1>
      <p className="mt-1 text-sm text-slate-600">Account: <span className="font-medium">{email}</span></p>

      <section className="card mt-6 p-5">
        <h2 className="section-title">Change password</h2>
        <form onSubmit={changePassword} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="npw">New password</label>
            <input id="npw" type="password" className="input" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} autoComplete="new-password" />
          </div>
          <div>
            <label className="label" htmlFor="npw2">Confirm new password</label>
            <input id="npw2" type="password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
          </div>
          {pwError && <p className="field-error sm:col-span-2">{pwError}</p>}
          <div className="sm:col-span-2">
            <button type="submit" disabled={savingPw} className="btn-primary">{savingPw ? "Saving…" : "Update password"}</button>
          </div>
        </form>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="section-title">Integrations</h2>
        <ul className="mt-2 space-y-2 text-sm text-slate-700">
          <li className="flex items-center justify-between gap-3"><span><strong>OpenAlex</strong> — live scholarly search (public API, no key required)</span><span className="badge-green badge">Available</span></li>
          <li className="flex items-center justify-between gap-3"><span><strong>External AI provider</strong> — optional Mode B drafting. Configured only via server environment variables (<code className="rounded bg-slate-100 px-1 text-xs">AI_PROVIDER_API_KEY</code>, <code className="rounded bg-slate-100 px-1 text-xs">AI_PROVIDER_BASE_URL</code>, <code className="rounded bg-slate-100 px-1 text-xs">AI_PROVIDER_MODEL</code>). Never stored in your browser.</span><span className="badge-slate badge">Server-configured</span></li>
          <li className="flex items-center justify-between gap-3"><span><strong>Template engine</strong> — deterministic email generation that works without any API key</span><span className="badge-green badge">Always available</span></li>
        </ul>
        <p className="mt-3 text-xs text-slate-500">When the AI provider is enabled, LetterDesk sends only the fields you see in Email Studio (name, background, experience, chosen skills/publication, verified topics). Uploaded documents and full profiles are never transmitted. If the provider fails, the template generator is used automatically.</p>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="section-title">Privacy</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li><strong>Stored on this server:</strong> your academic profile, CV upload (private, unlisted path), saved researchers/opportunities, email drafts, outreach records and roadmap tasks — visible only to you through authenticated access checks.</li>
          <li><strong>Stored in your browser:</strong> nothing sensitive beyond the session cookie (HttpOnly, signed).</li>
          <li><strong>Sent to third parties:</strong> search queries to OpenAlex (public scholarly catalog); optionally, draft inputs to the configured AI provider. Emails are never sent by LetterDesk — you initiate every send yourself.</li>
          <li><strong>Not logged:</strong> passwords, session tokens or full private drafts.</li>
        </ul>
      </section>

      <section className="card mt-6 p-5">
        <h2 className="section-title">Your data</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <button onClick={() => void exportData()} disabled={exporting} className="btn-secondary">{exporting ? "Preparing…" : "Export all my records (JSON)"}</button>
        </div>
        <p className="hint">Downloads your profile, saved researchers/opportunities, drafts, outreach records and roadmap tasks as one JSON file.</p>
      </section>

      <section className="card mt-6 border-red-200 p-5">
        <h2 className="section-title text-red-700">Danger zone</h2>
        <p className="mt-2 text-sm text-slate-700">Permanently delete your account, profile, uploads, drafts, tracker records and tasks. This cannot be undone. Export your data first if you want a copy.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input aria-label="Type DELETE to confirm" className="input max-w-40" placeholder='Type "DELETE"' value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
          <button onClick={() => void deleteAccount()} disabled={deleting || confirmText !== "DELETE"} className="btn-danger">{deleting ? "Deleting…" : "Delete my account"}</button>
        </div>
      </section>
    </div>
  );
}
