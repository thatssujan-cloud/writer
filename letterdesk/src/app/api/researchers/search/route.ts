import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { searchResearchers, UpstreamError } from "@/lib/openalex";
import { SAMPLE_RESEARCHERS } from "@/lib/sample-data";
import { computeMatch, type ProfileLike } from "@/lib/matching";
import { q1 } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const recentIps = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const arr = (recentIps.get(ip) ?? []).filter((t) => now - t < 10_000);
  if (arr.length >= 5) { recentIps.set(ip, arr); return true; }
  arr.push(now);
  recentIps.set(ip, arr);
  return false;
}

export async function GET(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in to search for researchers." }, { status: 401 });
  const ip = req.headers.get("x-forwarded-for") ?? "local";
  if (limited(ip)) {
    return NextResponse.json({ error: "Search rate limit reached. Please wait a few seconds.", retryAfter: 10 }, { status: 429 });
  }
  const sp = req.nextUrl.searchParams;
  const profileRow = q1<{ data: string }>("SELECT data FROM academic_profiles WHERE user_id=@uid", { uid: s.userId });
  let profileLike: ProfileLike | null = null;
  try { if (profileRow) profileLike = JSON.parse(profileRow.data) as ProfileLike; } catch { profileLike = null; }
  const noProfile = !profileLike || (!(profileLike.researchInterests?.length) && !(profileLike.skills?.length));
  const query = sp.get("q")?.trim() ?? "";
  const institution = sp.get("institution")?.trim() ?? "";
  const country = sp.get("country")?.trim() ?? "";
  const demo = sp.get("demo") === "1";
  const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);

  if (demo) {
    // Demo mode returns only clearly-marked fictional sample records.
    const q = query.toLowerCase();
    const results = q
      ? SAMPLE_RESEARCHERS.filter((r) => (r.name + " " + r.topics.join(" ") + " " + (r.institution ?? "")).toLowerCase().includes(q))
      : SAMPLE_RESEARCHERS;
    return NextResponse.json({
      results: results.map((r) => ({ ...r, match: computeMatch(profileLike, r) })),
      total: results.length, page: 1, pages: 1, demo: true, noProfile,
    });
  }

  if (!query && !institution) {
    return NextResponse.json({ error: "Enter a search term such as a name, topic, or publication title." }, { status: 400 });
  }

  try {
    const out = await searchResearchers({ query, institution, country, page, perPage: 12 });
    // Deduplicate by stable OpenAlex id (shared names are NOT merged — different IDs may be different people).
    const seen = new Set<string>();
    out.results = out.results.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
    return NextResponse.json({ ...out, results: out.results.map((r) => ({ ...r, match: computeMatch(profileLike, r) })), noProfile });
  } catch (e: any) {
    if (e instanceof UpstreamError) {
      const status = e.rateLimited ? 429 : 502;
      return NextResponse.json(
        { error: `${e.message}. No results were fabricated — please retry or adjust the search.`, upstream: true },
        { status }
      );
    }
    return NextResponse.json({ error: "Unexpected search error. Please try again." }, { status: 500 });
  }
}
