// SERVER-ONLY email verification: DNS MX/A checks + honest labels.
// NOTE: Do not import this module from client components (uses node:dns).
// For shared syntax checks import "@/lib/email-syntax" instead.
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
      // fall through to A lookup attempt below
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
