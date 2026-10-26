import Link from "next/link";
import { getSessionFromCookies } from "@/lib/auth";

export const dynamic = "force-dynamic";

const FEATURES = [
  { title: "Researcher Discovery", body: "Search real scholarly records from OpenAlex — authors, institutions, topics and publications with source links. We never fabricate professors.", href: "/discovery" },
  { title: "Transparent Matching", body: "See why a researcher fits your background: topic overlap, skills, experience evidence and geography, explained dimension by dimension.", href: "/discovery" },
  { title: "Funding & Opportunities", body: "Investigate assistantships, scholarships and funded projects with verification statuses and official source links — estimates are labeled as estimates.", href: "/funding" },
  { title: "Email Studio", body: "Draft concise, honest outreach emails using only verified details and information you provide. Edit everything before sending.", href: "/email-studio" },
  { title: "Outreach Tracker", body: "Manage contacts, statuses, follow-up windows and notes. Nothing is ever marked “sent” without your confirmation.", href: "/tracker" },
  { title: "Application Roadmap", body: "A practical checklist for shortlisting, documents, deadlines and interviews — progress persists across sessions.", href: "/roadmap" },
];

export default function Landing() {
  const session = getSessionFromCookies();
  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div>
          <span className="text-xl font-bold text-[#0f2447]">LetterDesk</span>
          <span className="ml-2 hidden text-sm text-slate-500 sm:inline">Graduate Research &amp; Funding Assistant</span>
        </div>
        <nav className="flex items-center gap-2">
          {session ? (
            <Link href="/dashboard" className="btn-primary">Open dashboard</Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">Sign in</Link>
              <Link href="/register" className="btn-primary">Get started</Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <section className="py-12 sm:py-20">
          <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight text-[#0f2447] sm:text-5xl">
            Your next research opportunity starts here.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
            Find researchers whose work fits your background. Explore funding opportunities, prepare thoughtful
            outreach, and manage every step of your graduate application journey.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={session ? "/dashboard" : "/register"} className="btn-primary px-6 py-3 text-base">
              {session ? "Continue to dashboard" : "Create your free account"}
            </Link>
            <a href="#how-it-works" className="btn-secondary px-6 py-3 text-base">How it works</a>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            LetterDesk retrieves real publication records from OpenAlex and stores your profile, drafts and tracker
            data on its server. Email drafts are never sent automatically. See Settings → Privacy for details.
          </p>
        </section>

        <section id="how-it-works" className="scroll-mt-16">
          <h2 className="text-xl font-bold text-[#0f2447] sm:text-2xl">The journey</h2>
          <ol className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-5">
            {["Build academic profile", "Discover researchers", "Evaluate funding", "Prepare outreach", "Track applications"].map((s, i) => (
              <li key={s} className="card p-4">
                <span className="badge-indigo mb-2 inline-flex rounded-full px-2 py-0.5 text-xs font-bold">Step {i + 1}</span>
                <p className="font-medium">{s}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-bold text-[#0f2447] sm:text-2xl">What LetterDesk does</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Link key={f.title} href={f.href} className="card block p-5 transition-shadow hover:shadow-md">
                <h3 className="font-semibold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{f.body}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-lg font-bold text-[#0f2447]">Honest by design</h2>
          <ul className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <li>✓ Real records from OpenAlex with source links and retrieval times.</li>
            <li>✓ Verification badges distinguish verified, estimated, historical and missing data.</li>
            <li>✗ No invented professors, publications, stipends or deadlines — ever.</li>
            <li>✗ No automatic email sending; you review and send yourself.</li>
            <li>✗ Fit scores are internal matching aids, not admission probabilities.</li>
            <li>✓ Your private drafts and notes are only visible to you.</li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        LetterDesk · Built for prospective graduate researchers seeking funded study.
      </footer>
    </div>
  );
}
