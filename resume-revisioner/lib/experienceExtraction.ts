import { ollamaJsonChat } from "./ollama";
import type { ExtractedExperienceFragment } from "./types";

const DEFAULT_HOST = "http://localhost:11434";

const EXTRACTION_SYSTEM_NOTE = `
Extract only facts explicitly present in the source text below — never invent
employers, dates, metrics, GPA, or skills. Omit a field entirely if the
source doesn't state it; do not guess or pad with plausible-sounding values.
If the source is a narrative paragraph rather than already-bulleted content,
phrase each "bullets[].text" as a resume-style bullet: past tense,
action-verb led, one sentence. Do NOT include "id" on any bullet or
certification, and do NOT include "included" anywhere — those are assigned
by the app after the user reviews this, never by you.

For start_date/end_date, if the source only states a month and year (no
specific day), use day "01" (e.g. "2023-06" -> "2023-06-01").

The field descriptions below (in parentheses) explain what a field MEANS —
they are not example values. Never copy a description's wording into the
output. If an array field (details, links, social_links, bullets, etc.) has
no real data in the source text, omit that key entirely rather than
including an empty or placeholder-filled array.

TARGET JSON SHAPE (include only the top-level keys you actually found data for):
{
  "meta": { "name", "email", "phone", "linkedin", "github", "website", "social_links": [{ "platform", "url" }] },
  "jobs": [{ "company", "role", "dates" (free text like "Jan 2023 - Present"), "start_date" ("YYYY-MM-DD"), "end_date" ("YYYY-MM-DD" or "present"), "location", "work_mode" ("Remote"/"Hybrid"/"On-site"), "hours_per_week" (number), "pay_plan", "pay_series", "pay_grade" (government roles only), "bullets": [{ "text", "tags": ["short-kebab-case-skill", "..."], "has_metric": boolean }] }],
  "projects": [{ "name", "dates", "links": [{ "name", "href" }], "bullets": [{ "text", "tags", "has_metric" }] }],
  "education": [{ "institution", "credential" (e.g. "Bachelor of Science - Computer Science"), "degree_level", "major", "dates", "graduation_date" ("YYYY-MM"), "gpa" (string), "location", "details" (array of notable courses/honors actually named in the source, one per string; omit if none named) }],
  "certifications": [{ "name", "issuer", "date" ("YYYY-MM"), "expiration_date", "credential_id" }],
  "technical_skills": { "<category>": [{ "skill", "source": "resume" }] }
}
`.trim();

function buildExtractionPrompt(rawText: string, sourceLabel: string): string {
  return `SOURCE TEXT (from: ${sourceLabel}):
"""
${rawText.trim()}
"""

${EXTRACTION_SYSTEM_NOTE}

Respond with ONLY one JSON object, no markdown fences, no commentary, matching the target shape above.`;
}

/** Sends raw extracted text (from an upload or pasted free text) to the
 * local Ollama model and returns a partial ExperienceData fragment for the
 * user to review before anything is merged into their experience bank. */
export async function extractExperienceFragment(
  rawText: string,
  sourceLabel: string,
  options: { model: string; host?: string }
): Promise<ExtractedExperienceFragment> {
  const host = (options.host || DEFAULT_HOST).replace(/\/+$/, "");
  const prompt = buildExtractionPrompt(rawText, sourceLabel);
  const parsed = await ollamaJsonChat<ExtractedExperienceFragment>(host, options.model, prompt);
  return parsed && typeof parsed === "object" ? parsed : {};
}
