// Editorial review checklist for drafts (objective checks separated from subjective advice).
export interface ReviewItem { kind: "objective" | "advice"; ok: boolean; label: string; detail: string }

export function reviewDraft(input: {
  subject: string;
  body: string;
  professorName: string;
  studentName: string;
  hasResearchConnection: boolean;
  contactEmail: string;
}): { items: ReviewItem[]; score: number } {
  const items: ReviewItem[] = [];
  const body = input.body;
  const words = body.split(/\s+/).filter((w) => /[\w]/.test(w)).length;

  // ---- objective checks ----
  items.push({ kind: "objective", ok: input.subject.trim().length > 0, label: "Subject line present", detail: input.subject.trim() ? `Subject: “${input.subject.trim()}”` : "Add a subject line before sending." });
  items.push({ kind: "objective", ok: words >= 60 && words <= 260, label: `Word count: ${words}`, detail: words < 60 ? "Very short emails can feel abrupt; consider adding one concrete sentence about your background." : words > 260 ? "Professors skim; consider trimming below ~250 words." : "Within the recommended 60–260 word range for first contact." });
  const hasGreeting = /^(dear|hello|hi)\b/im.test(body);
  items.push({ kind: "objective", ok: hasGreeting, label: "Greeting present", detail: hasGreeting ? "A respectful greeting was detected." : "Start with “Dear Professor …”." });
  const hasSignoff = /(sincerely|best regards|respectfully|kind regards|with appreciation)[,\s]*\n?[^\n]*$/im.test(body);
  items.push({ kind: "objective", ok: hasSignoff, label: "Closing & signature present", detail: hasSignoff ? "Professional closing detected." : "End with a closing phrase and your name." });
  const mentionsName = input.professorName ? body.toLowerCase().includes(input.professorName.split(/\s+/).pop()!.toLowerCase()) : false;
  items.push({ kind: "objective", ok: !!input.professorName && mentionsName, label: "Professor addressed by name", detail: !input.professorName ? "No professor name on file — set it in Email Studio inputs." : mentionsName ? "The professor's surname appears in the draft." : "Address the professor by name in the greeting." });
  const claimsAttachment = /please (find )?attach|attached (are|is)|i (have )?attach/i.test(body);
  const attachmentPrepared = /cv|transcript/i.test(body) && !claimsAttachment;
  items.push({ kind: "objective", ok: !claimsAttachment || attachmentPrepared, label: "Attachment promises", detail: claimsAttachment ? "The draft promises attachments — make sure they are actually prepared before sending." : "The draft does not promise unprepared attachments." });

  // ---- subjective advice ----
  items.push({ kind: "advice", ok: input.hasResearchConnection, label: "Specific research connection", detail: input.hasResearchConnection ? "The draft references a specific publication or research topic." : "Add one concrete sentence about a paper or topic of theirs — generic praise is easy to spot." });
  const flattery = /(world[- ]class|renowned|prestigious|amazing|inspiring|huge fan|honored|distinguished)/i.test(body);
  items.push({ kind: "advice", ok: !flattery, label: "Avoids generic flattery", detail: flattery ? "Terms like “world-class” or “renowned” read as filler. Describe the work itself instead." : "No hollow compliments detected." });
  const sentences = body.split(/[.!?]+\s/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const dupes = sentences.filter((s, idx) => sentences.findIndex((t) => t === s) !== idx);
  items.push({ kind: "advice", ok: dupes.length === 0, label: "No repeated sentences", detail: dupes.length ? `Repeated: “${dupes[0].slice(0, 60)}…”` : "Sentences are distinct." });
  items.push({ kind: "advice", ok: /\?\s/.test(body) || /would.*(consider|appreciate|welcome)/i.test(body), label: "Clear, respectful request", detail: /\?\s/.test(body) ? "The draft contains a direct question." : "Consider ending with one clear question (availability, next step)." });
  items.push({ kind: "advice", ok: !!input.contactEmail, label: "Contact email available", detail: input.contactEmail ? "An address is on file; verify its source before relying on it." : "No recipient email yet — find it on the official department page and record the source." });
  items.push({ kind: "advice", ok: /i\s/.test(body) && words > 80, label: "Evidence of fit", detail: words > 80 ? "The draft has room to show your background; check every claim matches your real profile." : "Include one verifiable fact about your experience (thesis, method, tool)." });

  const passed = items.filter((x) => x.ok).length;
  return { items, score: Math.round((passed / items.length) * 100) };
}
