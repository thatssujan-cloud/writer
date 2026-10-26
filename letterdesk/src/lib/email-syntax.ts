// Client-safe email syntax checks only (no node imports). Shared by browser and server.
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
