"""Resume-vs-JD analysis: per-section bullet scoring, skill-gap detection,
and candidate-fit overview generation. Streams progress events, then a final
result event, to POST /ollama/analyze."""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from .keywords import build_bullet_haystack, humanize_tag, term_included, tokenize, STOPWORDS
from .models import AnalyzeRequest, Section
from .ollama_client import normalize_host, ollama_json_chat

router = APIRouter()


# ---------------------------------------------------------------------------
# Per-section bullet scoring
# ---------------------------------------------------------------------------


def build_section_scoring_prompt(section: Section, jd_text: str) -> str:
    bullets = [{"id": b.id, "text": b.text, "tags": b.tags} for b in section.bullets]
    return f"""JOB DESCRIPTION:
\"\"\"
{jd_text.strip()}
\"\"\"

RESUME SECTION: "{section.label}"
BULLETS:
{json.dumps(bullets, indent=2)}

TASK: Score each bullet's relevance to the job description above on a 0-100 scale (100 = directly demonstrates a core requirement of the role, 0 = completely unrelated). For every bullet, write a "reason": one specific sentence (20 words or fewer). If the score is low, name what's missing or why it doesn't align — don't just say "not relevant" or "low relevance".

Respond with ONLY one JSON object, no markdown fences, no commentary, covering EVERY bullet id exactly once:
{{
  "bullets": [ {{ "id": "<bullet id>", "score": <integer 0-100>, "reason": "<reason>" }} ]
}}"""


def hydrate_section_from_picks(section: Section, parsed: Any, max_bullets: int) -> dict:
    picks = parsed.get("bullets") if isinstance(parsed, dict) else None
    picks = picks if isinstance(picks, list) else []
    by_id = {p.get("id"): p for p in picks if isinstance(p, dict) and isinstance(p.get("id"), str)}

    scored: list[dict] = []
    for bullet in section.bullets:
        pick = by_id.get(bullet.id)
        raw_score = pick.get("score") if pick else None
        raw_score = raw_score if isinstance(raw_score, (int, float)) and not isinstance(raw_score, bool) else 0
        score = max(0, min(100, round(raw_score)))
        reason_val = pick.get("reason") if pick else None
        if isinstance(reason_val, str) and reason_val.strip():
            reason = reason_val.strip()
        elif pick:
            reason = None
        else:
            reason = "Ollama did not return a score for this bullet — review manually."
        scored.append(
            {
                "id": bullet.id,
                "text": bullet.text,
                "tags": bullet.tags,
                "has_metric": bullet.has_metric,
                "score": score,
                "reason": reason,
                "matchedKeywords": [],
            }
        )

    ranked = sorted(scored, key=lambda b: (-b["score"], 0 if b["has_metric"] else 1))

    return {
        "id": section.id,
        "kind": section.kind,
        "label": section.label,
        "dates": section.dates,
        "location": section.location,
        "company": section.company,
        "role": section.role,
        "links": [link.model_dump() for link in section.links] if section.links else section.links,
        "totalBullets": len(section.bullets),
        "shownBullets": ranked[: max(1, max_bullets)],
    }


# ---------------------------------------------------------------------------
# Gap-finding (tag-list framing + deterministic "already covered" safety net
# against small-model hallucination)
# ---------------------------------------------------------------------------


def build_gaps_prompt(sections: list[Section], jd_text: str) -> str:
    all_tags = sorted({humanize_tag(t) for s in sections for b in s.bullets for t in b.tags})

    return f"""JOB DESCRIPTION:
\"\"\"
{jd_text.strip()}
\"\"\"

SKILLS/TECHNOLOGIES ALREADY ON THE RESUME (do not list any of these, or close synonyms of them, as a gap):
{", ".join(all_tags)}

TASK: Read the job description above carefully. List up to 10 short phrases (3-6 words each, no trailing ellipsis or punctuation) for skills, technologies, or qualifications that are EXPLICITLY stated in the job description text above but are NOT in the "already on the resume" list. Only use wording that actually appears in the job description — do not invent, assume, or add generic requirements just because they're common for similar roles (e.g. don't add "Agile", "CI/CD", "cloud platforms", or "security testing" unless the job description text above literally mentions them). If the job description only supports fewer than 10 genuine gaps, return fewer — do not pad the list.

Respond with ONLY one JSON object, no markdown fences, no commentary, matching exactly this shape:
{{
  "gaps": ["<phrase>", "..."]
}}"""


def is_already_covered(phrase: str, bullet_haystack: str) -> bool:
    words = [w for w in tokenize(phrase) if len(w) >= 3 and w not in STOPWORDS]
    if not words:
        return term_included(bullet_haystack, phrase)
    return all(term_included(bullet_haystack, w) for w in words)


def hydrate_gaps(parsed: Any, bullet_haystack: str) -> list[dict]:
    gaps = parsed.get("gaps") if isinstance(parsed, dict) else None
    gaps = gaps if isinstance(gaps, list) else []
    seen: set[str] = set()
    result: list[dict] = []
    for g in gaps:
        if not isinstance(g, str):
            continue
        keyword = g.strip()
        key = keyword.lower()
        if not keyword or key in seen:
            continue
        if is_already_covered(keyword, bullet_haystack):
            continue
        seen.add(key)
        result.append({"keyword": keyword})
        if len(result) >= 15:
            break
    return result


# ---------------------------------------------------------------------------
# Overview generation
# ---------------------------------------------------------------------------


def build_overview_prompt(sections: list[dict], gaps: list[dict], jd_text: str) -> str:
    score_lines = "\n".join(
        f"- {s['label']}: top score {max([0] + [b['score'] for b in s['shownBullets']])}" for s in sections
    )
    gap_list = ", ".join(g["keyword"] for g in gaps) if gaps else "none identified"

    return f"""JOB DESCRIPTION:
\"\"\"
{jd_text.strip()}
\"\"\"

BULLET SCORES BY RESUME SECTION (0-100 relevance to the job description):
{score_lines}

IDENTIFIED GAPS: {gap_list}

TASK: Write a short candidate-fit overview (3-5 sentences): overall alignment with the role, the 2-3 strongest matching experiences (name them specifically), and the most important gaps to address in a cover letter or interview. Be direct and specific about actual technologies/skills — no generic filler like "the candidate seems like a good fit". IMPORTANT: the bullet scores measure how well the candidate's EXISTING resume bullets match the job description — they are not a list of the candidate's skills. The IDENTIFIED GAPS list is the authoritative source for what's missing from the resume. Never say the candidate has, is "familiar with", or is "notable for" a skill/technology solely because it's mentioned in the job description — only attribute a skill to the candidate if it's implied by their actual bullet content (reflected in a high score), and only call something a gap if it appears in the IDENTIFIED GAPS list above.

Respond with ONLY one JSON object, no markdown fences, no commentary: {{ "overview": "<3-5 sentences>" }}"""


def hydrate_overview(parsed: Any) -> str | None:
    overview = parsed.get("overview") if isinstance(parsed, dict) else None
    return overview.strip() if isinstance(overview, str) and overview.strip() else None


# ---------------------------------------------------------------------------
# Orchestration: streams progress events, then a final result event
# ---------------------------------------------------------------------------


async def analyze_with_ollama_stream(req: AnalyzeRequest) -> AsyncIterator[dict]:
    host = normalize_host(req.host)
    model = req.model

    ranked_sections: list[dict] = []
    for i, section in enumerate(req.sections):
        yield {
            "type": "progress",
            "stage": "scoring",
            "current": i + 1,
            "total": len(req.sections),
            "label": section.label,
        }

        try:
            parsed = await ollama_json_chat(host, model, build_section_scoring_prompt(section, req.jdText))
        except Exception as err:
            # One section's failure shouldn't sink the whole analysis — fall
            # back to zero-scored bullets (still shown, in original order)
            # and surface the error via each bullet's reason so it's visible
            # in the UI.
            message = str(err)
            parsed = {
                "bullets": [
                    {"id": b.id, "score": 0, "reason": f"Scoring failed: {message}"} for b in section.bullets
                ]
            }
        ranked_sections.append(hydrate_section_from_picks(section, parsed, req.maxBullets))

    warnings: list[str] = []

    yield {"type": "progress", "stage": "gaps"}
    bullet_haystack = build_bullet_haystack(req.sections)
    gaps: list[dict] = []
    try:
        gaps_parsed = await ollama_json_chat(host, model, build_gaps_prompt(req.sections, req.jdText))
        gaps = hydrate_gaps(gaps_parsed, bullet_haystack)
    except Exception as err:
        warnings.append(f"Skill-gap detection failed ({err}) — the empty list below may not mean full coverage.")

    yield {"type": "progress", "stage": "overview"}
    overview: str | None = None
    try:
        overview_parsed = await ollama_json_chat(host, model, build_overview_prompt(ranked_sections, gaps, req.jdText))
        overview = hydrate_overview(overview_parsed)
    except Exception as err:
        warnings.append(f"Overview generation failed: {err}")

    result = {
        "mode": "ollama",
        "sections": ranked_sections,
        "gaps": gaps,
        "overview": overview,
        "warnings": warnings or None,
    }
    yield {"type": "result", "data": result}


@router.post("/analyze")
async def analyze_endpoint(req: AnalyzeRequest) -> StreamingResponse:
    async def stream() -> AsyncIterator[bytes]:
        try:
            async for event in analyze_with_ollama_stream(req):
                yield (json.dumps(event) + "\n").encode("utf-8")
        except Exception as err:
            yield (json.dumps({"type": "error", "message": str(err)}) + "\n").encode("utf-8")

    return StreamingResponse(stream(), media_type="application/x-ndjson")
