"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErrors({}); setFormError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (res.ok) { router.push("/profile?onboarding=1"); router.refresh(); return; }
      if (data.fields) setErrors(data.fields); else setFormError(data.error ?? "Registration failed.");
    } catch {
      setFormError("Network error — please try again.");
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-6 text-center text-xl font-bold text-[#0f2447]">LetterDesk</Link>
      <form onSubmit={submit} className="card space-y-4 p-6" noValidate>
        <h1 className="text-lg font-semibold text-slate-900">Create your account</h1>
        <p className="text-sm text-slate-600">Your profile and drafts are stored on the LetterDesk server and visible only to you.</p>
        {formError && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{formError}</p>}
        <div>
          <label htmlFor="name" className="label">Full name</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
          {errors.name && <p className="field-error">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          {errors.email && <p className="field-error">{errors.email}</p>}
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required minLength={8} />
          {errors.password && <p className="field-error">{errors.password}</p>}
          <p className="hint">At least 8 characters.</p>
        </div>
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating account…" : "Start building my profile"}</button>
        <p className="text-center text-sm text-slate-600">Already registered? <Link className="font-medium text-indigo-700 underline" href="/login">Sign in</Link></p>
      </form>
    </main>
  );
}
