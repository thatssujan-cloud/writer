import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getResearcher, getPublications, UpstreamError } from "@/lib/openalex";
import { SAMPLE_RESEARCHERS } from "@/lib/sample-data";
import { q1, run } from "@/lib/db";
import { computeMatch } from "@/lib/matching";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const id = decodeURIComponent(params.id);

  let researcher = null as null | Awaited<ReturnType<typeof getResearcher>>;
  const cached = q1<{ payload: string }>("SELECT payload FROM researcher_cache WHERE openalex_id = @id", { id });
  try {
    if (id.startsWith("sample:")) {
      researcher = SAMPLE_RESEARCHERS.find((r) => r.id === id) ?? null;
    } else if (cached) {
      researcher = JSON.parse(cached.payload);
    } else {
      researcher = await getResearcher(id);
      if (researcher) {
        const pubs = await getPublications(id).catch(() => []);
        researcher.publications = pubs;
        run(`INSERT OR REPLACE INTO researcher_cache (openalex_id, payload, fetched_at) VALUES (@id, @p, @t)`,
          { id, p: JSON.stringify(researcher), t: new Date().toISOString() });
      }
    }
    if (!researcher) return NextResponse.json({ error: "Researcher record not found at the source." }, { status: 404 });

    // ensure publications present even when served from cache without them
    if (!researcher.publications?.length && id.startsWith("openalex:")) {
      researcher.publications = await getPublications(id).catch(() => []);
    }

    const profRow = q1<{ data: string }>("SELECT data FROM academic_profiles WHERE user_id = @uid", { uid: s.userId });
    const profile = profRow ? JSON.parse(profRow.data) : null;
    const match = computeMatch(profile, researcher);
    const saved = !!q1<{ id: number }>("SELECT id FROM saved_researchers WHERE user_id = @uid AND researcher_id = @rid", { uid: s.userId, rid: id });
    return NextResponse.json({ researcher, match, saved });
  } catch (e: any) {
    if (e instanceof UpstreamError) {
      return NextResponse.json({ error: `${e.message}. Nothing was fabricated — please retry.` }, { status: e.rateLimited ? 429 : 502 });
    }
    return NextResponse.json({ error: "Could not load researcher details." }, { status: 500 });
  }
}
