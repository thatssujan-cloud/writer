import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 400_000; // read at most ~400 KB of any page

/**
 * POST /api/opportunities/lookup  { url }
 * Honest page-inspection helper: fetches a user-supplied official page and reports
 * what it could NOT confirm as much as what keywords it saw. Never invents deadlines.
 */
export async function POST(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const raw = String(body?.url ?? "").trim();
  let u: URL;
  try {
    u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) throw new Error("bad protocol");
  } catch {
    return NextResponse.json({ error: "Enter a valid http(s) URL of the official page you want inspected." }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(u.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "LetterDesk/0.1 (personal study aid; page inspection)" },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return NextResponse.json({
        status: "no_information",
        detail: `The page responded with HTTP ${res.status}. LetterDesk could not read it and will not guess its contents.`,
        caveat: "Open the page directly in your browser to read the official terms.",
      });
    }
    const text = (await res.text()).slice(0, MAX_BYTES);
    const plain = text.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
    const found: string[] = [];
    const checks: [string, RegExp][] = [
      ["deadline-related wording", /\b(deadline|closing date|apply by|application (?:closes|end|deadline))/i],
      ["funding/stipend wording", /\b(fund(?:ed|ing)|stipend|scholarship|tuition|assistantship|fellowship)\b/i],
      ["eligibility wording", /\beligib/i],
      ["degree level wording", /\b(phd|doctoral|master'?s?)\b/i],
      ["intake/start wording", /\b(intake|fall|spring|autumn|winter|semester)\b/i],
    ];
    for (const [label, re] of checks) if (re.test(plain)) found.push(label);

    const explicitDate = plain.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i)?.[0] ?? null;

    return NextResponse.json({
      status: found.length >= 3 ? "official_unconfirmed" : "no_information",
      detail: found.length === 0
        ? "The page loaded, but LetterDesk could not identify any funding/deadline/eligibility wording in it. It may be JavaScript-rendered or not the right page."
        : `The page mentions: ${found.join(", ")}.${explicitDate ? ` A date string (“${explicitDate}”) appears somewhere on the page — positions vary, so do NOT assume it is the application deadline.` : ""}`,
      caveat: "Automated reading cannot confirm meaning. Verify every figure and date visually on this official page before relying on it.",
    });
  } catch (e: any) {
    clearTimeout(timer);
    return NextResponse.json({
      status: "no_information",
      detail: `LetterDesk could not fetch that page (${String(e?.name ?? "network error")}). Nothing was fabricated.`,
      caveat: "Some sites block automated requests. Open the page yourself and record key facts manually in your tracker notes.",
    });
  }
}
