// Transparent keyword-based matching between an academic profile and a researcher record.
import type { Researcher, MatchResult, MatchDimension } from "@/lib/types";

export interface ProfileLike {
  researchInterests?: string[];
  skills?: string[];
  thesisExperience?: string;
  workExperience?: string;
  fieldOfStudy?: string;
  achievements?: string;
  targetCountries?: string[];
  intendedDegree?: string;
}

const STOP = new Set([
  "and","the","of","for","with","in","on","to","a","an","using","use","based","study","studies",
  "research","new","high","low","via","by","at","is","are","from","into","their","its","as","also",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s+-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function jaccardOverlap(a: Set<string>, b: Set<string>): { score: number; shared: string[] } {
  const shared: string[] = [];
  for (const t of a) if (b.has(t)) shared.push(t);
  const union = new Set([...a, ...b]).size || 1;
  return { score: shared.length / union, shared };
}

export function computeMatch(profile: ProfileLike | null, r: Researcher): MatchResult {
  const dims: MatchDimension[] = [];
  if (!profile) {
    return {
      score: 0,
      band: "limited",
      dimensions: [{ label: "Profile evidence", score: 0, detail: "No academic profile available yet — complete your profile to enable matching." }],
    };
  }

  const interestTokens = new Set(tokenize((profile.researchInterests ?? []).join(" ")));
  const skillTokens = new Set(tokenize((profile.skills ?? []).join(" ")));
  const experienceTokens = new Set(
    tokenize([profile.thesisExperience, profile.workExperience, profile.achievements, profile.fieldOfStudy].filter(Boolean).join(" "))
  );
  const topicTokens = new Set(tokenize(r.topics.join(" ") + " " + r.publications.map((p) => p.title).join(" ")));
  const pubTokens = new Set(tokenize(r.publications.map((p) => p.title).join(" ")));

  // 1. Research topic alignment (weight 45%)
  const topic = jaccardOverlap(interestTokens, topicTokens);
  dims.push({
    label: "Research topic alignment",
    score: topic.score,
    detail: topic.shared.length
      ? `Shared terms with their topics/publications: ${topic.shared.slice(0, 8).join(", ")}.`
      : "No overlapping research terms found in their listed topics or recent publications.",
  });

  // 2. Skills & methodology overlap (weight 30%)
  const skill = jaccardOverlap(skillTokens, pubTokens.size ? new Set([...pubTokens, ...topicTokens]) : topicTokens);
  dims.push({
    label: "Skills & methods overlap",
    score: skill.score,
    detail: skill.shared.length
      ? `Your skills appear in their work titles/topics: ${skill.shared.slice(0, 8).join(", ")}.`
      : "No direct overlap between your listed skills and their publication vocabulary.",
  });

  // 3. Supporting experience evidence (weight 15%)
  const exp = jaccardOverlap(experienceTokens, topicTokens);
  dims.push({
    label: "Experience evidence",
    score: exp.score,
    detail: exp.shared.length
      ? `Your thesis/work description shares terms with their research: ${exp.shared.slice(0, 6).join(", ")}.`
      : "Little keyword overlap between your described experience and their research areas.",
  });

  // 4. Geographic preference (weight 10%)
  let geoScore = 0;
  let geoDetail = "You have not set target countries in your profile.";
  if (r.country && profile.targetCountries?.length) {
    const targets = profile.targetCountries.map((c) => c.trim().toUpperCase());
    const rc = r.country.toUpperCase();
    const NAME_TO_CC: Record<string, string> = { USA: "US", "UNITED STATES": "US", UK: "GB", "UNITED KINGDOM": "GB", "USA.": "US" };
    const norm = targets.map((t) => NAME_TO_CC[t] ?? t);
    if (norm.includes(rc)) { geoScore = 1; geoDetail = `Their institution is in ${r.country}, one of your target countries.`; }
    else { geoScore = 0.2; geoDetail = `Their institution is in ${r.country}, which is not among your target countries (${targets.join(", ")}).`; }
  } else if (!r.country) {
    geoDetail = "Country not available for this record.";
  }
  dims.push({ label: "Geographic fit", score: geoScore, detail: geoDetail });

  const W = [0.45, 0.3, 0.15, 0.1];
  const raw = dims.reduce((acc, d, i) => acc + d.score * W[i], 0);
  // Evidence availability damping: very short profiles shouldn't look like perfect non-matches.
  const evidence = interestTokens.size + skillTokens.size;
  const confidence = Math.min(1, evidence / 8);
  const score = Math.round(100 * raw * (0.4 + 0.6 * confidence));

  const band: MatchResult["band"] =
    evidence < 3 || confidence < 0.35 ? "limited" : score >= 35 ? "strong" : score >= 15 ? "partial" : "limited";

  return { score, band, dimensions: dims };
}

export const BAND_LABELS: Record<MatchResult["band"], string> = {
  strong: "Strong research alignment",
  partial: "Partial research alignment",
  limited: "Limited available evidence",
};
