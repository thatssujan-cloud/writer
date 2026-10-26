// Email address validation: syntax (client+server shared), suspicious patterns, DNS MX check (server only).
// IMPORTANT: passing checks never proves a mailbox exists.

const SYNTAX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export interface SyntaxReport { valid: boolean; messages: string[] }

export function checkSyntax(email: string): SyntaxReport {
  const msgs: string[] = [];
  const e = email.trim();
  if (!e) return { valid: false, messages: ["Address is empty."] };
  if (/\s/.test(e)) msgs.push("Contains whitespace.");
  if (!SYNTAX.test(e)) msgs.push("Does not match a standard email format.");
  if (/^[^@]+@[^@]*--/.test(e)) msgs.push("Domain looks unusual (double hyphen).");
  if (e.split("@")[1]?.startsWith(".")) msgs.push("Domain starts with a dot.");
  if ((e.match(/\.\./g) ?? []).length > 0) msgs.push("Contains consecutive dots.");
  const freeMailDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"];
  const domain = e.split("@")[1]?.toLowerCase() ?? "";
  if (msgs.length === 0 && freeMailDomains.includes(domain)) {
    msgs.push("Free email domain — for university outreach, prefer an official institutional address from the department page.");
  }
  return { valid: SYNTAX.test(e) && !/\s/.test(e), messages: msgs };
}

// NOTE: checkDns is server-side only (uses node:dns). Do not import it from client components.
import { promises as dnsPromises, resolveMx as resolveMxCb } from "node:dns";
import { promisify } from "node:util";
const resolveMx = promisify(resolveMxCb);

export type DnsResult = "mx_found" | "no_mx" | "a_fallback" | "lookup_failed" | "skipped";

export async function checkDns(email: string): Promise<{ result: DnsResult; detail: string }> {
  const domain = email.trim().split("@")[1];
  if (!domain) return { result: "skipped", detail: "No domain to check." };
  try {
    const mx = await resolveMx(domain);
    if (mx.length > 0) return { result: "mx_found", detail: `Mail exchanger records found for ${domain}.` };
  } catch (e: any) {
    if (e?.code !== "ENODATA" && e?.code !== "ENOTFOUND") {
      // fall through to A lookup attempt below for ENODATA/ENOTFOUND only handled as no-mx path
    }
  }
  try {
    const a = await dnsPromises.resolve(domain);
    if (a.length > 0) return { result: "a_fallback", detail: `No MX records, but ${domain} has A records. Mail delivery unconfirmed.` };
    return { result: "no_mx", detail: `No MX or A records found for ${domain}. The address is likely invalid.` };
  } catch {
    return { result: "no_mx", detail: `No MX records and domain ${domain} does not resolve. The address is likely invalid.` };
  }
}

export function verificationLabel(result: DnsResult): string {
  switch (result) {
    case "mx_found": return "Domain mail-server records detected";
    case "a_fallback": return "Domain resolves, mail server unconfirmed";
    case "no_mx": return "Domain has no mail records";
    case "lookup_failed": return "Verification unavailable (DNS error)";
    default: return "Not checked";
  }
}
