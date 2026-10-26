import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPublications, UpstreamError } from "@/lib/openalex";
import { SAMPLE_RESEARCHERS } from "@/lib/sample-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const id = decodeURIComponent(params.id);
  try {
    if (id.startsWith("sample:")) {
      const r = SAMPLE_RESEARCHERS.find((x) => x.id === id);
      return NextResponse.json({ publications: r?.publications ?? [], sample: true });
    }
    const pubs = await getPublications(id);
    return NextResponse.json({ publications: pubs });
  } catch (e: any) {
    if (e instanceof UpstreamError) {
      return NextResponse.json({ error: `${e.message}. No publications were invented — please retry.` }, { status: e.rateLimited ? 429 : 502 });
    }
    return NextResponse.json({ error: "Could not load publications." }, { status: 500 });
  }
}
