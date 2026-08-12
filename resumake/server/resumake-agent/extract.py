"""Experience extraction ("My Experience" tab: upload/paste -> Ollama ->
review), for POST /ollama/extract."""

from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException

from .models import ExtractRequest
from .ollama_client import normalize_host, ollama_json_chat

router = APIRouter()

EXTRACTION_SYSTEM_NOTE = """
Extract only facts explicitly present in the source text below — never invent
employers, dates, metrics, or GPA. Omit a field entirely if the source
doesn't state it; do not guess or pad with plausible-sounding values.
If the source text contains no job, project, or education content at all —
for example, a file that only lists contact info or social media links —
do not invent any. Omit the jobs/projects/education/certifications keys
entirely rather than fabricating an entry to fill them.
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

Do NOT extract technical skills/tools/languages/frameworks here — those are
handled by a separate pass, so ignore any "Skills" section of the source text
for this task.

TARGET JSON SHAPE (include only the top-level keys you actually found data for):
{
  "meta": { "name", "email", "phone", "linkedin", "github", "website", "social_links": [{ "platform", "url" }] },
  "jobs": [{ "company", "role", "dates" (free text like "Jan 2023 - Present"), "start_date" ("YYYY-MM-DD"), "end_date" ("YYYY-MM-DD" or "present"), "location", "work_mode" ("Remote"/"Hybrid"/"On-site"), "hours_per_week" (number), "pay_plan", "pay_series", "pay_grade" (government roles only), "bullets": [{ "text", "tags" (technologies/skills mentioned in that bullet, short kebab-case, e.g. "python"/"rest-api" — omit if none), "has_metric": boolean }] }],
  "projects": [{ "name", "dates", "links": [{ "name", "href" }], "bullets": [{ "text", "tags", "has_metric" }] }],
  "education": [{ "institution", "credential" (e.g. "Bachelor of Science - Computer Science"), "degree_level", "major", "dates", "graduation_date" ("YYYY-MM"), "gpa" (string), "location", "details" (array of notable courses/honors actually named in the source, one per string; omit if none named) }],
  "certifications": [{ "name", "issuer", "date" ("YYYY-MM"), "expiration_date", "credential_id" }]
}
""".strip()

TECHNICAL_SKILLS_SYSTEM_NOTE = """
Extract ONLY technical skills, tools, programming languages, and frameworks
mentioned in the source text below — ignore jobs, projects, education, and
everything else. Never invent a skill that isn't explicitly present in the
source text.

Group skills into categories. If the source text already groups them under
headings (e.g. "Languages:", "Developer Tools:", "Frameworks:"), use those
same headings as category names. If skills are listed with no grouping, use
your own judgment to group them sensibly (e.g. "Languages", "Frameworks &
Tools"). If the source text has no technical skills at all, return
{ "technical_skills": {} }.

Respond with ONLY one JSON object, no markdown fences, no commentary,
matching exactly this shape:
{ "technical_skills": { "<category>": [{ "skill": "<skill exactly as written in the source>" }] } }
""".strip()


def build_extraction_prompt(raw_text: str, source_label: str) -> str:
    return f"""SOURCE TEXT (from: {source_label}):
\"\"\"
{raw_text.strip()}
\"\"\"

{EXTRACTION_SYSTEM_NOTE}

Respond with ONLY one JSON object, no markdown fences, no commentary, matching the target shape above."""


def build_technical_skills_prompt(raw_text: str, source_label: str) -> str:
    return f"""SOURCE TEXT (from: {source_label}):
\"\"\"
{raw_text.strip()}
\"\"\"

{TECHNICAL_SKILLS_SYSTEM_NOTE}"""


async def extract_experience_fragment(req: ExtractRequest) -> dict:
    """Runs as two separate calls (core jobs/projects/education/etc., and
    technical skills) rather than one combined call — asking a small local
    model for every section plus a skills breakdown in a single JSON response
    made it unreliable about including the trailing "technical_skills" key at
    all, even when the source text clearly had a skills section."""
    host = normalize_host(req.host)
    warnings: list[str] = []

    core_result, skills_result = await asyncio.gather(
        ollama_json_chat(host, req.model, build_extraction_prompt(req.rawText, req.sourceLabel)),
        ollama_json_chat(host, req.model, build_technical_skills_prompt(req.rawText, req.sourceLabel)),
        return_exceptions=True,
    )

    if isinstance(core_result, BaseException):
        raise core_result
    fragment: dict = core_result if isinstance(core_result, dict) else {}

    if isinstance(skills_result, BaseException):
        warnings.append(
            f'Technical skills extraction failed for "{req.sourceLabel}" ({skills_result}) — add them manually below.'
        )
    else:
        technical_skills = skills_result.get("technical_skills") if isinstance(skills_result, dict) else None
        if isinstance(technical_skills, dict):
            fragment["technical_skills"] = technical_skills

    return {"fragment": fragment, "warnings": warnings}


@router.post("/extract")
async def extract_endpoint(req: ExtractRequest) -> dict:
    try:
        return await extract_experience_fragment(req)
    except Exception as err:
        raise HTTPException(status_code=502, detail=str(err)) from err
