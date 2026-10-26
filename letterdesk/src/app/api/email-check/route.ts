import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkSyntax, checkDns, verificationLabel } from "@/lib/email-check";

export const runtime = "nodejs";

// Server-side email verification endpoint. Returns honest labels only.
export async function POST(req: NextRequest) {
  const s = getSession(req);
  if (!s) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const email = String(body?.email ?? "").trim().slice(0, 254);
  const syntax = checkSyntax(email);
  if (!syntax.valid) {
    return NextResponse.json({
      syntaxValid: false,
      messages: syntax.messages,
      dns: null,
      label: "Syntax invalid",
      caveat: "No mailbox verification is possible for a malformed address.",
    });
  }
  let dnsResult = null;
  try {
    dnsResult = await checkDns(email);
  } catch {
    dnsResult = { result: "lookup_failed" as const, detail: "DNS lookup failed (network restriction)." };
  }
  return NextResponse.json({
    syntaxValid: true,
    messages: syntax.messages,
    dns: dnsResult,
    label: verificationLabel(dnsResult.result),
    caveat:
      "A valid syntax or functioning mail server does NOT prove this individual mailbox exists or that your email will reach the intended professor. Prefer addresses listed by a credible official source.",
  });
}
