// Mode A — deterministic template email generator. Works without any AI API key.
import type { EmailMode } from "@/lib/types";

export interface TemplateInput {
  mode: EmailMode;
  studentName: string;
  signature?: string;
  targetDegree: "masters" | "phd" | "undecided";
  intendedIntake?: string;
  professorName: string;
  professorEmail?: string;
  institution?: string;
  background?: string;          // e.g. "MSc candidate in Environmental Engineering at X University"
  experience?: string;          // relevant research / professional experience (user supplied)
  publicationTitle?: string;    // a specific paper the student read
  publicationYear?: number | null;
  topics?: string[];            // researcher topics (verified records only)
  skills?: string[];            // 1-2 genuinely relevant skills chosen by user
  opportunityType?: string;     // what is being requested, e.g. "PhD position with RA funding"
  tone: "formal" | "warm" | "direct";
  targetLength: "short" | "standard";
  originalMessageSummary?: string; // for follow-ups
}

export interface GeneratedEmail { subject: string; body: string; notes: string[] }

function salutation(professorName: string): { text: string; note?: string } {
  const n = professorName.trim();
  if (!n) return { text: "Dear Professor,", note: "Professor name missing — add it before sending." };
  // If the record already includes an honorific, reuse it.
  if (/^(prof|associate prof|assistant prof|dr|mr|mrs|ms)\b/i.test(n)) {
    const cleaned = n.replace(/\bassistant professor\b/i, "Professor").replace(/\bassociate professor\b/i, "Professor").trim();
    return { text: `Dear ${cleaned},` };
  }
  const parts = n.split(/\s+/);
  return { text: `Dear Professor ${parts[parts.length - 1]},`, note: "Greeting uses 'Professor' + surname from the source record; confirm their preferred title on their official page." };
}

function joinList(items: (string | undefined | null)[], conj = " and "): string {
  const clean = items.filter((x): x is string => !!x && x.trim().length > 0).map((s) => s.trim());
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  return clean.slice(0, -1).join(", ") + conj + clean[clean.length - 1];
}

function skillPhrase(skills: string[]): string {
  const s = skills.slice(0, 2);
  if (s.length === 0) return "";
  if (s.length === 1) return `hands-on experience with ${s[0]}`;
  return `experience with ${joinList(s)}`;
}

export function generateTemplateEmail(i: TemplateInput): GeneratedEmail {
  const notes: string[] = [];
  const sal = salutation(i.professorName);
  if (sal.note) notes.push(sal.note);

  const intake = i.intendedIntake?.trim() ? ` ${i.intendedIntake.trim()}` : "";
  const degreeWord = i.targetDegree === "masters" ? "master's" : i.targetDegree === "phd" ? "PhD" : "graduate";
  const background = i.background?.trim() || i.experience?.trim() || "";
  if (!background) notes.push("No academic background supplied — the draft uses general wording. Add your background in Email Studio for a stronger email.");
  const sk = skillPhrase(i.skills ?? []);
  if ((i.skills ?? []).length > 2) notes.push("Only the first two listed skills were used to keep the email focused.");

  const topicStr = joinList((i.topics ?? []).slice(0, 3), ", ");
  const pubRef = i.publicationTitle?.trim()
    ? `I recently read "${i.publicationTitle.trim()}${i.publicationYear ? ` (${i.publicationYear})` : ""}" `
    : topicStr
      ? `Your group's work on ${topicStr} `
      : "";
  if (!i.publicationTitle && !topicStr) notes.push("No publication or verified research topic was available — the connection paragraph is intentionally general. Consider reading one recent paper and adding its title.");

  const opp = i.opportunityType?.trim() ||
    (i.mode.id === "ra_inquiry" ? "a research assistantship while pursuing my studies"
      : i.mode.id === "ta_inquiry" ? "teaching assistantship opportunities"
      : i.mode.id === "grant_project" ? "opportunities connected to this project"
      : `prospective ${degreeWord} student opportunities`);

  const ask =
    i.tone === "direct"
      ? `Are you currently accepting new ${degreeWord} students for${intake || " upcoming"} intakes?`
      : i.tone === "warm"
        ? `If you are open to it, I would be glad to hear whether you expect to welcome new ${degreeWord} students${intake ? ` for ${i.intendedIntake}` : " in the coming intakes"}.`
        : `I would like to respectfully ask whether you anticipate accepting new ${degreeWord} students${intake ? ` for the ${i.intendedIntake} intake` : " in upcoming intakes"}, and whether ${opp.includes("assistant") ? opp : `support such as ${opp}`} may be available.`;

  const paraBackground = background
    ? `${background}${sk ? `, including ${sk}` : ""}.`
    : sk ? `I have ${sk}.` : "";

  const closings: Record<string, string> = {
    formal: "Respectfully,",
    warm: "With appreciation,",
    direct: "Best regards,",
  };
  const signoff = `${closings[i.tone] ?? "Best regards,"}\n${i.signature?.trim() || i.studentName || "[Your name]"}`;

  let subject = "";
  let body = "";

  switch (i.mode.id) {
    case "first_contact":
      subject = `Prospective ${degreeWord} student — ${topicStr ? topicStr.split(",")[0] : "your research group"}`;
      body = [
        sal.text,
        `My name is ${i.studentName || "[your name]"}${background ? ` and ${background.toLowerCase().startsWith("i ") ? background.charAt(0).toLowerCase() + background.slice(1) : `I am ${background}`}` : "."}`,
        pubRef ? `${pubRef}${topicStr ? `and was particularly interested in how it connects to ${topicStr.split(",")[0]}.` : "and found it closely aligned with my interests."}` : `I am writing because your research aligns strongly with my interests${topicStr ? ` in ${topicStr}` : ""}.`,
        paraBackground ? `${paraBackground}` : "",
        ask,
        `Thank you for your time.${i.intendedIntake ? ` I plan to apply for ${degreeWord} programs starting ${i.intendedIntake}.` : ""}`,
        signoff,
      ].filter(Boolean).join("\n\n");
      break;

    case "ra_inquiry":
      subject = `Prospective ${degreeWord} student interested in ${topicStr ? topicStr.split(",")[0] : "your group's research"} — RA inquiry`;
      body = [
        sal.text,
        `My name is ${i.studentName || "[your name]"}${background ? `. ${background}` : "."}`,
        pubRef ? `${pubRef}and it directly relates to the work I have done${i.experience ? ": " + lowercaseFirst(i.experience.trim()) : "."}` : `I have followed your group's work${topicStr ? ` on ${topicStr}` : ""} and see a strong fit with my background.`,
        paraBackground ? `In my studies so far, ${lowercaseFirst(paraBackground)}` : "",
        `I am writing to ask whether you expect to have research assistantship openings${intake ? ` for ${i.intendedIntake}` : ""}, and whether you are currently considering prospective ${degreeWord} students. ${ask}`,
        "I would be happy to share my CV and transcripts if useful.",
        signoff,
      ].filter(Boolean).join("\n\n");
      break;

    case "ta_inquiry":
      subject = `Prospective ${degreeWord} student — teaching assistantship question`;
      body = [
        sal.text,
        `My name is ${i.studentName || "[your name]"}${background ? `. ${background}` : "."}`,
        paraBackground ? `${paraBackground}` : "",
        `I am planning to apply for ${degreeWord} programs${intake ? ` starting ${i.intendedIntake}` : ""}${i.institution ? ` and I am very interested in ${i.institution}` : ""}. I wanted to ask whether your department typically offers teaching assistantships to incoming graduate students, and whether courses related to ${topicStr || "your area"} are covered by the TA program.`,
        ask,
        signoff,
      ].filter(Boolean).join("\n\n");
      break;

    case "grant_project":
      subject = `Interest in ${i.publicationTitle ? shorten(i.publicationTitle, 60) : topicStr ? topicStr.split(",")[0] : "your funded research"} — prospective ${degreeWord} student`;
      body = [
        sal.text,
        `My name is ${i.studentName || "[your name]"}${background ? `. ${background}` : "."}`,
        pubRef ? `${pubRef}${topicStr ? `and I would like to learn more about how that line of work is developing.` : "and I would like to learn more about how that work is developing."}` : `I am writing about your current research${topicStr ? ` on ${topicStr}` : ""}.`,
        paraBackground ? `${paraBackground}` : "",
        `If this project or related work continues to need support, I would value the chance to contribute. ${ask}`,
        "I understand availability of funded positions depends on the project and its sponsors, and I am glad to provide any additional information you need.",
        signoff,
      ].filter(Boolean).join("\n\n");
      break;

    case "follow_up":
      subject = `Following up: prospective ${degreeWord} student inquiry`;
      body = [
        sal.text,
        `I hope this message finds you well. I wrote recently${i.originalMessageSummary ? ` about ${i.originalMessageSummary}` : " regarding my interest in joining your research group"} and wanted to gently follow up, knowing this is a busy time of year.`,
        `My interest remains strong${topicStr ? `, especially in your work on ${topicStr.split(",")[0]}` : ""}${sk ? `, where I can bring ${skillPhrase(i.skills ?? [])}` : ""}.`,
        "If now is not a good time, no reply is needed — I appreciate your consideration either way.",
        signoff,
      ].filter(Boolean).join("\n\n");
      break;

    case "general_research":
    default:
      subject = `Prospective ${degreeWord} student — interest in your research`;
      body = [
        sal.text,
        `My name is ${i.studentName || "[your name]"}${background ? `. ${background}` : "."}`,
        pubRef ? `${pubRef}${topicStr ? `and it connects closely with the questions I want to pursue in graduate school.` : "and it connects closely with the questions I want to pursue in graduate school."}` : `I am writing to express interest in your research${topicStr ? ` on ${topicStr}` : ""}.`,
        paraBackground ? `${paraBackground}` : "",
        ask,
        "If you are open to a brief conversation, I would be grateful. I can share my CV and academic records at your convenience.",
        signoff,
      ].filter(Boolean).join("\n\n");
      break;
  }

  if (i.targetLength === "short") body = shortenBody(body);
  return { subject: subject.trim(), body: body.trim(), notes };
}

function lowercaseFirst(s: string): string { return s.charAt(0).toLowerCase() + s.slice(1); }
function shorten(s: string, n: number): string { return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…"; }

/** Keep greeting, first two paragraphs, trimmed ask, and sign-off. */
export function shortenBody(body: string): string {
  const paras = body.split(/\n\n+/);
  if (paras.length <= 4) return body;
  const greet = paras[0];
  const middle = paras.slice(1, -1);
  const sign = paras[paras.length - 1];
  const kept = middle.slice(0, Math.max(1, middle.length - 2));
  return [greet, ...kept, sign].join("\n\n");
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\w]/.test(w)).length;
}

// ---------- Lightweight rewriting helpers (deterministic, no AI key required) ----------

const FILLER_PATTERNS: [RegExp, string][] = [
  [/\bi have a keen interest\b/gi, "I am interested"],
  [/\bkeen interest\b/gi, "interest"],
  [/\bvery much\b/gi, ""],
  [/\breally\b/gi, ""],
  [/\bactually\b/gi, ""],
  [/\bjust\b/gi, ""],
  [/\bauxiliar/i, "auxiliary"], // no-op guard
  [/\bhuge fan of\b/gi, "I have followed"],
  [/\bit would be an absolute honor to\b/gi, "I would value the chance to"],
  [/\bit would be an honour to\b/gi, "I would value the chance to"],
  [/\bI am writing to express my sincere interest\b/gi, "I am writing about my interest"],
  [/\bsincere(?:ly)?\s+interest\b/gi, "interest"],
  [/\bwith great enthusiasm\b/gi, ""],
  [/\bpassionate about\b/gi, "interested in"],
  [/\bcutting-edge\b/gi, "recent"],
  [/\bstate-of-the-art\b/gi, "current"],
  [/\bnovel and innovative\b/gi, "new"],
];

/** Deterministic grammar/clarity cleanup. No content is invented; only filler words and spacing are fixed. */
export function grammarFix(text: string): string {
  let t = text.replace(/[ \t]{2,}/g, " ").replace(/ ([,.!?;:])/g, "$1").replace(/\?([?!])/g, "?$1");
  for (const [re, rep] of FILLER_PATTERNS) t = t.replace(re, rep);
  t = t.replace(/ +([,.!?])/g, "$1").replace(/([,.!?]) {2,}/g, "$1 ");
  t = t.replace(/\b(\w+) \1\b/gi, "$1"); // repeated word like "the the"
  t = t.replace(/^(\w)/, (m) => m.toUpperCase());
  t = t.replace(/\n{3,}/g, "\n\n").trim();
  return t;
}

/** Replace hollow compliments with neutral phrasing so praise becomes description of the work. */
export function improveResearchConnection(body: string, topics: string[] = []): string {
  let t = body
    .replace(/\byour (?:amazing|incredible|world[- ]class|prestigious|renowned) (?:work|research)\b/gi, "your research")
    .replace(/\bI am (?:truly |deeply |extremely )?(?:inspired|impressed|honored|humbled) by\b/gi, "I want to learn more about")
    .replace(/\bI have (?:long )?admired\b/gi, "I have read");
  const topicStr = topics.slice(0, 2).join(" and ");
  if (topicStr) {
    t = t.replace(/\byour research\b(?!.{0,40}\b(on|in|about)\b)/i, `your research on ${topicStr}`);
  }
  return t.trim();
}

/** Make phrasing less stiff/formulaic without changing facts. */
export function rewriteNaturally(body: string): string {
  let t = body
    .replace(/\bI hope this email finds you well\.?\s*/gi, "I hope you are doing well. ")
    .replace(/\bPlease do not hesitate to contact me\b/gi, "I am glad to answer any questions")
    .replace(/\bdo not hesitate to reach out\b/gi, "feel free to ask")
    .replace(/\bFurthermore,?\b/gi, "Also,")
    .replace(/\bMoreover,?\b/gi, "In addition,")
    .replace(/\bWith due respect,\s*/gi, "")
    .replace(/\bRespectfully yours,?\b/gi, "Respectfully,")
    .replace(/\battain(?:ing)?\b/gi, "complete")
    .replace(/\butilize\b/gi, "use")
    .replace(/\bin order to\b/gi, "to")
    .replace(/\bsubsequent(?:ly)?\b/gi, "later")
    .replace(/\bpursuant to\b/gi, "following");
  return grammarFix(t);
}

/** Tone swap: keep identical content, adjust greeting/closing/formality markers. */
export function changeTone(body: string, tone: "formal" | "warm" | "direct"): string {
  const closings: Record<string, string> = { formal: "Respectfully,", warm: "With appreciation,", direct: "Best regards," };
  let t = body.replace(
    /(Sincerely|Best regards|Kind regards|Respectfully(,? yours)?|With appreciation)[,\.]?\s*\n\s*([^\n]+)$/i,
    `${closings[tone]}\n$2`
  );
  if (tone === "direct") {
    t = t.replace(/\bIf you are open to it,?\s*/gi, "").replace(/\bI would be grateful if\b/gi, "I would like it if");
  } else if (tone === "warm") {
    t = t.replace(/\bI would like to respectfully ask\b/gi, "I would love to ask");
  } else {
    t = t.replace(/\bI would love to\b/gi, "I would like to");
  }
  return t.trim();
}
