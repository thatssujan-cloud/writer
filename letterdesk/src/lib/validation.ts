import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  name: z.string().min(1, "Name is required.").max(120),
});

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const csv = (v: unknown) =>
  typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : Array.isArray(v) ? v : [];

const listField = z.preprocess(csv, z.array(z.string().max(120)).max(50).optional());

const optionalText = z.string().max(4000).optional().or(z.literal(""));

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required.").max(120),
  currentUniversity: z.string().max(200).optional().or(z.literal("")),
  currentDegree: z.string().max(120).optional().or(z.literal("")),
  fieldOfStudy: z.string().max(120).optional().or(z.literal("")),
  intendedDegree: z.enum(["masters", "phd", "undecided"]).optional(),
  targetCountries: listField,
  targetUniversities: listField,
  intendedIntake: z.string().max(60).optional().or(z.literal("")),
  researchInterests: listField,
  thesisExperience: optionalText,
  workExperience: optionalText,
  skills: listField,
  achievements: optionalText,
  gpa: z
    .string()
    .max(20)
    .optional()
    .refine((v) => !v || /^[\d.]{1,6}(\/[\d.]{1,6})?$/.test(v), "GPA should look like 3.6 or 3.6/4.0"),
  languageTest: z.string().max(200).optional().or(z.literal("")),
  cvLink: z.string().url("CV link must be a valid URL (https://...).").optional().or(z.literal("")),
  fundingNotes: z.string().max(2000).optional().or(z.literal("")),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const outreachCreateSchema = z.object({
  researcherId: z.string().min(1),
  researcherName: z.string().min(1).max(200),
  institution: z.string().max(200).optional().or(z.literal("")),
  topic: z.string().max(300).optional().or(z.literal("")),
  email: z.string().email("Enter a valid contact email.").optional().or(z.literal("")),
  emailSource: z.string().max(300).optional().or(z.literal("")),
  status: z.string().max(40).optional().or(z.literal("")),
  notes: optionalText,
});

export const outreachUpdateSchema = z.object({
  status: z.string().max(40).optional(),
  notes: optionalText,
  followUpDate: z.string().max(30).nullable().optional(),
  contactedAt: z.string().max(30).nullable().optional(),
  lastResponseAt: z.string().max(30).nullable().optional(),
  nextAction: z.string().max(500).optional(),
  messageSnapshot: z.string().max(20000).optional(),
});

export const roadmapTaskSchema = z.object({
  title: z.string().trim().min(1, "Task title is required.").max(200),
  dueDate: z.string().max(30).optional().or(z.literal("")),
  linkedTo: z.string().max(200).optional().or(z.literal("")),
});

export const draftSaveSchema = z.object({
  researcherId: z.string().max(120).optional().or(z.literal("")),
  researcherName: z.string().max(200).optional().or(z.literal("")),
  mode: z.string().max(40).optional().or(z.literal("")),
  subject: z.string().max(300),
  body: z.string().max(20000),
});

export function formatZodError(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
