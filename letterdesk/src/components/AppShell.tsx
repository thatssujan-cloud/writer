"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/discovery", label: "Researcher Discovery" },
  { href: "/funding", label: "Funding & Opportunities" },
  { href: "/email-studio", label: "Email Studio" },
  { href: "/tracker", label: "Outreach Tracker" },
  { href: "/roadmap", label: "Application Roadmap" },
  { href: "/profile", label: "Academic Profile" },
  { href: "/settings", label: "Settings" },
];

export default function AppShell({ children, user }: { children: React.ReactNode; user: { name: string; email: string } }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Link href="/dashboard" className="text-lg font-bold text-[#0f2447]">LetterDesk</Link>
        <button
          className="btn-secondary px-3 py-1.5"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Close menu" : "Menu"}
        </button>
      </header>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile navigation" className="border-b border-slate-200 bg-white p-3 lg:hidden">
          <ul className="grid grid-cols-2 gap-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith(n.href) ? "bg-indigo-50 font-semibold text-indigo-800" : "text-slate-700 hover:bg-slate-100"}`}
                >{n.label}</Link>
              </li>
            ))}
            <li><button onClick={logout} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50">Sign out</button></li>
          </ul>
        </nav>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
        <div className="border-b border-slate-100 px-5 py-4">
          <Link href="/" className="block text-xl font-bold text-[#0f2447]">LetterDesk</Link>
          <p className="mt-0.5 text-xs text-slate-500">Graduate Research &amp; Funding Assistant</p>
        </div>
        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className={`block rounded-lg px-3 py-2 text-sm ${pathname.startsWith(n.href) ? "bg-indigo-50 font-semibold text-indigo-800" : "text-slate-700 hover:bg-slate-100"}`}
                >{n.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-slate-100 p-4">
          <p className="truncate text-sm font-medium text-slate-800">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
          <button onClick={logout} disabled={busy} className="btn-ghost mt-2 w-full justify-start px-2 text-red-700 hover:bg-red-50">
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>

      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
