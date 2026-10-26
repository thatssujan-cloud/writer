// Shared domain types for LetterDesk

export type VerificationStatus = "verified" | "unofficial" | "estimated" | "missing";

export interface Publication {
  title: string;
  year: number | null;
  doi: string | null;
  url: string | null;
  venue: string | null;
  citedBy: number | null;
}

export interface Researcher {
  id: string; // stable id, e.g. openalex:A...
  name: string;
  institution: string | null;
  department: string | null;
  country: string | null;
  topics: string[];
  worksCount: number | null;
  citedByCount: number | null;
  email: string | null;
  emailStatus: VerificationStatus;
  profileUrl: string | null;
  publications: Publication[];
  source: "openalex" | "sample";
  retrievedAt: string;
  profileText?: string;
}

export interface MatchDimension {
  label: string;
  score: number; // 0..1
  detail: string;
}

export interface MatchResult {
  score: number; // 0..100 internal heuristic
  band: "strong" | "partial" | "limited";
  dimensions: MatchDimension[];
}

export type OpportunityCategory =
  | "RA"
  | "TA"
  | "graduate_position"
  | "funded_phd"
  | "university_scholarship"
  | "external_fellowship"
  | "grant_project"
  | "doctoral_program";

export type OppVerification =
  | "verified_current"
  | "official_unconfirmed"
  | "historical"
  | "estimated_window"
  | "generic_guidance"
  | "no_information";

export interface FundingOpportunity {
  id: string;
  title: string;
  provider: string; // university / department / organization
  category: OpportunityCategory;
  degreeLevel: "masters" | "phd" | "both" | null;
  field: string | null;
  country: string | null;
  fundingDetails: string | null;
  eligibility: string | null;
  deadline: string | null; // ISO date, only if documented in source
  deadlineIsEstimated: boolean;
  startDate: string | null;
  url: string;
  verification: OppVerification;
  lastChecked: string;
  sample?: boolean;
}

export type OutreachStatus =
  | "to_research"
  | "saved"
  | "drafting"
  | "ready_to_contact"
  | "contacted"
  | "follow_up_due"
  | "replied"
  | "meeting"
  | "application_in_progress"
  | "offer_received"
  | "closed";

export const OUTREACH_STATUSES: { value: OutreachStatus; label: string }[] = [
  { value: "to_research", label: "To research" },
  { value: "saved", label: "Saved" },
  { value: "drafting", label: "Drafting" },
  { value: "ready_to_contact", label: "Ready to contact" },
  { value: "contacted", label: "Contacted" },
  { value: "follow_up_due", label: "Follow-up due" },
  { value: "replied", label: "Replied" },
  { value: "meeting", label: "Meeting / interview" },
  { value: "application_in_progress", label: "Application in progress" },
  { value: "offer_received", label: "Offer received" },
  { value: "closed", label: "Closed / not pursuing" },
];

export interface EmailMode {
  id: "ra_inquiry" | "ta_inquiry" | "general_research" | "grant_project" | "first_contact" | "follow_up";
  label: string;
  description: string;
}

export const EMAIL_MODES: EmailMode[] = [
  { id: "ra_inquiry", label: "Research Assistantship inquiry", description: "Ask about RA positions in the professor's group." },
  { id: "ta_inquiry", label: "Teaching Assistantship inquiry", description: "Ask about TA opportunities related to your strengths." },
  { id: "general_research", label: "Prospective student / collaboration", description: "General inquiry about joining the research group." },
  { id: "grant_project", label: "Grant-funded project inquiry", description: "Reference a specific funded project or publication." },
  { id: "first_contact", label: "Concise first contact", description: "Short ~100-word introductory email." },
  { id: "follow_up", label: "Follow-up", description: "Polite reminder after a previous unanswered email." },
];
