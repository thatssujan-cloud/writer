// Server-side OpenAlex API client. No API key required; polite pool used via mailto param.
import type { Researcher, Publication } from "@/lib/types";

const OA = "https://api.openalex.org";
const CONTACT = process.env.OPENALEX_MAILTO || ""; // optional polite-pool email

export class UpstreamError extends Error {
  status: number;
  rateLimited: boolean;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.rateLimited = status === 429;
  }
}

async function fetchJson(url: string, timeoutMs = 12000): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": `LetterDesk/1.0 (research discovery tool${CONTACT ? "; " + CONTACT : ""})` },
    });
    if (!res.ok) {
      throw new UpstreamError(`OpenAlex request failed with status ${res.status}`, res.status);
    }
    return await res.json();
  } catch (e: any) {
    if (e?.name === "AbortError") throw new UpstreamError("OpenAlex request timed out", 504);
    if (e instanceof UpstreamError) throw e;
    throw new UpstreamError("Could not reach OpenAlex (network error)", 502);
  } finally {
    clearTimeout(t);
  }
}

function withMailto(params: URLSearchParams) {
  if (CONTACT) params.set("mailto", CONTACT);
  return params.toString();
}

interface RawAuthor {
  id: string;
  display_name: string;
  orcid?: string | null;
  last_known_institutions?: { institution: { display_name: string; country_code?: string }; departments?: string[] }[];
  affiliation_information?: { institution: { display_name: string; country_code?: string }; departments?: string[] };
  works_count?: number;
  cited_by_count?: number;
  concepts?: { display_name: string; score?: number }[];
  topics?: { display_name: string }[];
  profile?: { bio?: string };
  url?: string;
  specs?: string[];
}

function authorId(raw: RawAuthor): string {
  // stable id: openalex:A123...
  const m = raw.id.match(/A\d+$/);
  return `openalex:${m ? m[0] : raw.id}`;
}

function mapAuthor(raw: RawAuthor): Researcher {
  const inst = raw.last_known_institutions?.[0]?.institution ?? raw.affiliation_information?.institution;
  const dept = raw.last_known_institutions?.[0]?.departments?.[0] ?? raw.affiliation_information?.departments?.[0] ?? null;
  const topics = (raw.topics ?? []).slice(0, 6).map((t) => t.display_name);
  if (topics.length === 0) topics.push(...(raw.concepts ?? []).slice(0, 6).map((c) => c.display_name));
  const hasEmail = !!(raw.specs ?? []).some((s: string) => String(s).startsWith("email:"));
  return {
    id: authorId(raw),
    name: raw.display_name,
    institution: inst?.display_name ?? null,
    department: dept ?? null,
    country: inst?.country_code ?? null,
    topics,
    worksCount: raw.works_count ?? null,
    citedByCount: raw.cited_by_count ?? null,
    email: null, // we never scrape emails; only shown when user supplies them
    emailStatus: hasEmail ? "unofficial" : "missing",
    profileUrl: raw.url ?? null,
    publications: [],
    source: "openalex",
    retrievedAt: new Date().toISOString(),
  };
}

function mapWork(w: any): Publication {
  return {
    title: w.display_name ?? "(untitled)",
    year: w.publication_year ?? null,
    doi: w.doi ? String(w.doi).replace("https://doi.org/", "") : null,
    url: w.doi ?? w.open_access?.oa_url ?? `https://openalex.org/${String(w.id).split("/").pop()}`,
    venue: w.primary_location?.source?.display_name ?? null,
    citedBy: w.cited_by_count ?? null,
  };
}

export interface SearchParams {
  query?: string;          // free text: name / topic / title
  institution?: string;
  country?: string;        // ISO code e.g. US, CA, GB, DE, AU
  page?: number;           // 1-based
  perPage?: number;        // max 50
}

export async function searchResearchers(p: SearchParams): Promise<{ results: Researcher[]; total: number; page: number; pages: number }> {
  const params = new URLSearchParams();
  const filterParts: string[] = [];
  if (p.institution) filterParts.push(`last_known_institutions.country_code:${p.country || "unspecified"}`);
  if (p.country && !p.institution) filterParts.push(`last_known_institutions.country_code:${p.country.toUpperCase()}`);
  if (p.institution) {
    // institution handled through search instead of exact filter for flexibility
  }
  if (filterParts.length) params.set("filter", filterParts.join(","));
  const searchTerms = [p.query, p.institution].filter(Boolean).join(" ");
  if (searchTerms) params.set("search", searchTerms);
  params.set("per-page", String(Math.min(p.perPage ?? 12, 50)));
  params.set("page", String(Math.max(p.page ?? 1, 1)));
  params.set("sort", "cited_by_count:desc");
  params.set("select", "id,display_name,orcid,last_known_institutions,works_count,cited_by_count,topics,concepts,url,specs");

  const data = await fetchJson(`${OA}/authors?${withMailto(params)}`);
  const meta = data.meta ?? {};
  const results: Researcher[] = (data.results ?? []).map(mapAuthor);
  return { results, total: meta.count ?? results.length, page: meta.page ?? 1, pages: Math.ceil((meta.count ?? 0) / (meta.per_page ?? 1)) };
}

export async function getResearcher(id: string): Promise<Researcher | null> {
  const m = id.match(/^openalex:(A\d+)$/);
  if (!m) return null;
  try {
    const data = await fetchJson(`${OA}/authors/${m[1]}?${withMailto(new URLSearchParams({ select: "id,display_name,orcid,last_known_institutions,affiliation_information,works_count,cited_by_count,topics,concepts,profile,url,specs" }))}`);
    const r = mapAuthor(data);
    r.profileText = data.profile?.bio ?? undefined;
    return r;
  } catch (e) {
    if (e instanceof UpstreamError && e.status === 404) return null;
    throw e;
  }
}

export async function getPublications(id: string): Promise<Publication[]> {
  const m = id.match(/^openalex:(A\d+)$/);
  if (!m) return [];
  const params = new URLSearchParams();
  params.set("filter", `author.id:${m[1]}`);
  params.set("sort", "publication_year:desc,display_name_search:asc");
  params.set("per-page", "12");
  params.set("select", "id,display_name,publication_year,doi,primary_location,cited_by_count,open_access");
  const data = await fetchJson(`${OA}/works?${withMailto(params)}`);
  return (data.results ?? []).map(mapWork);
}

/** Cross-check helper: verify a DOI resolves via OpenAlex (returns work title or null). */
export async function lookupDoi(doi: string): Promise<{ title: string; year: number | null } | null> {
  try {
    const clean = doi.replace(/^https?:\/\/doi\.org\//, "");
    const data = await fetchJson(`${OA}/works/https://doi.org/${encodeURIComponent(clean)}?${withMailto(new URLSearchParams({ select: "display_name,publication_year" }))}`);
    if (!data?.display_name) return null;
    return { title: data.display_name, year: data.publication_year ?? null };
  } catch {
    return null;
  }
}
