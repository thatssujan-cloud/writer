import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { generateTemplateEmail, shortenBody, wordCount } from "@/lib/email-template";
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

  const input = {
    mode: { id: modeId as EmailMode["id"], label: modeId, description: "" },
    studentName: String(body.studentName ?? "").slice(0, 120),
    signature: body.signature ? String(body.signature).slice(0, 300) : undefined,
    targetDegree: ["masters", "phd"].includes(body.targetDegree) ? body.targetDegree : "undecided",
    intendedIntake: body.intendedIntake ? String(body.intendedIntake).slice(0, 60) : undefined,
    professorName: String(body.professorName ?? "").slice(0, 200),
    professorEmail: body.professorEmail ? String(body.professorEmail).slice(0, 254) : undefined,
    institution: body.institution ? String(body.institution).slice(0, 200) : undefined,
    background: body.background ? String(body.background).slice(0, 1000) : undefined,
    experience: body.experience ? String(body.experience).slice(0, 2000) : undefined,
    publicationTitle: body.publicationTitle ? String(body.publicationTitle).slice(0, 400) : undefined,
    publicationYear: Number.isFinite(Number(body.publicationYear)) ? Number(body.publicationYear) : null,
    topics: Array.isArray(body.topics) ? body.topics.slice(0, 6).map((t: unknown) => String(t).slice(0, 120)) : [],
    skills: Array.isArray(body.skills) ? body.skills.slice(0, 4).map((t: unknown) => String(t).slice(0, 80)) : [],
    opportunityType: body.opportunityType ? String(body.opportunityType).slice(0, 200) : undefined,
    tone: ["formal", "warm", "direct"].includes(body.tone) ? body.tone : "formal",
    targetLength: body.targetLength === "short" ? "short" : "standard",
    originalMessageSummary: body.originalMessageSummary ? String(body.originalMessageSummary).slice(0, 300) : undefined,
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
        verifiedTopics: input.topics,
        publicationTitle: input.publicationTitle,
        studentName: input.studentName,
        background: input.background ?? "",
        experience: input.experience ?? "",
        skills: input.skills,
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
