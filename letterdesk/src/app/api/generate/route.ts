import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateTemplateEmail, shortenBody, wordCount, type TemplateInput } from "@/lib/email-template";
import { aiConfigured, aiGenerate } from "@/lib/ai-provider";
import type { EmailMode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODES: EmailMode["id"][] = ["ra_inquiry","ta_inquiry","general_research","grant_project","first_contact","follow_up"];

/**
 * POST /api/generate
 * body: { engine: "template" | "ai", instruction?: "generate"|"shorten"|"natural"|"tone"|"connection"|"grammar", ...TemplateInput fields }
 */
export async function POST(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const engine = body.engine === "ai" ? "ai" : "template";
  const modeId = MODES.includes(body.mode) ? body.mode : "general_research";
  const instruction = String(body.instruction ?? "generate").slice(0, 40);

  // Editing operations that work purely on the current text (no provider needed).
  if (instruction === "shorten" && typeof body.currentBody === "string") {
    return NextResponse.json({ subject: String(body.subject ?? ""), body: shortenBody(body.currentBody.slice(0, 20000)), engine: "editor" });
  }

  const str = (v: unknown, max: number): string | undefined =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

  const input: TemplateInput = {
    mode: { id: modeId, label: modeId, description: "" } as EmailMode,
    studentName: String(body.studentName ?? "").slice(0, 120),
    signature: str(body.signature, 300),
    targetDegree: (["masters", "phd"] as const).includes(body.targetDegree) ? body.targetDegree : "undecided",
    intendedIntake: str(body.intendedIntake, 60),
    professorName: String(body.professorName ?? "").slice(0, 200),
    professorEmail: str(body.professorEmail, 254),
    institution: str(body.institution, 200),
    background: str(body.background, 1000),
    experience: str(body.experience, 2000),
    publicationTitle: str(body.publicationTitle, 400),
    publicationYear: Number.isFinite(Number(body.publicationYear)) ? Number(body.publicationYear) : null,
    topics: Array.isArray(body.topics) ? body.topics.slice(0, 6).map((t: unknown) => String(t).slice(0, 120)) : [],
    skills: Array.isArray(body.skills) ? body.skills.slice(0, 4).map((t: unknown) => String(t).slice(0, 80)) : [],
    opportunityType: str(body.opportunityType, 200),
    tone: (["formal", "warm", "direct"] as const).includes(body.tone) ? body.tone : "formal",
    targetLength: body.targetLength === "short" ? "short" : "standard",
    originalMessageSummary: str(body.originalMessageSummary, 300),
  };

  if (engine === "ai") {
    if (!aiConfigured()) {
      const t = generateTemplateEmail(input);
      return NextResponse.json({
        ...t, engine: "template",
        fallbackReason: "External AI provider is not configured on this server (see Settings → Integrations). The deterministic template generator was used instead.",
      });
    }
    try {
      const extraInstruction =
        instruction === "natural" ? "Rewrite the previous draft to sound more natural and human; keep every fact unchanged." :
        instruction === "connection" ? "Strengthen the research-connection paragraph using only the provided verified topics/publication. Do not invent new claims." :
        instruction === "grammar" ? "Fix grammar, punctuation and clarity only. Keep wording and facts essentially unchanged." :
        instruction === "tone" ? `Adjust the tone to be ${input.tone}. Keep facts unchanged.` :
        "";
      const out = await aiGenerate({
        mode: modeId,
        professorName: input.professorName,
        verifiedTopics: input.topics ?? [],
        publicationTitle: input.publicationTitle,
        studentName: input.studentName,
        background: input.background ?? "",
        experience: input.experience ?? "",
        skills: input.skills ?? [],
        targetDegree: input.targetDegree,
        intake: input.intendedIntake,
        tone: input.tone,
        instruction: extraInstruction || undefined,
      });
      return NextResponse.json({ subject: out.subject, body: out.body, notes: [`Draft produced by external AI provider (${process.env.AI_PROVIDER_MODEL}). Review every claim before sending — treat it as a suggestion, not verified content.`], engine: "ai" });
    } catch (e: any) {
      const t = generateTemplateEmail(input);
      return NextResponse.json({
        ...t, engine: "template",
        fallbackReason: `AI provider failed (${String(e?.message ?? "error").slice(0, 160)}). Template generator was used instead.`,
      });
    }
  }

  const t = generateTemplateEmail(input);
  return NextResponse.json({ ...t, engine: "template", words: wordCount(t.body) });
}

// GET exposes only non-secret configuration status for the UI.
export async function GET() {
  return NextResponse.json({ aiConfigured: aiConfigured() });
}
