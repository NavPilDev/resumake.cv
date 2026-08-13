"""Deterministic ATS-scoring engine.

Ported from sunnypatell/ats-screener's src/lib/engine/scorer/ (MIT
licensed. See /resumake/NOTICE). This simulates how six real ATS platforms parse and weight a resume: same input always produces the same output, no model call
involved.

Exposes POST /ollama/analyze/ats-score as a standalone request/response
endpoint. The ATS Scorer tab is a standalone testing surface, and the computation is fast/synchronous, so there is no per-item progress worth streaming.
"""

from __future__ import annotations

import math

from fastapi import APIRouter, HTTPException

from .engine import score_resume
from .types import AtsScoreRequest, ScoreResult, ScoringInput

router = APIRouter()

# Rough estimate: ~550 words fit on one page of a dense single-column
# 10-11pt resume (matching latex-resumes/.latexmkrc's typical output).
# We have no real page-layout info here (that requires an actual
# LaTeX/PDF compile, which this JSON endpoint doesn't do) — this is a
# deliberate heuristic, not a precise count, used only to feed
# format_scorer's page-count penalty.
_WORDS_PER_PAGE = 550


def _build_scoring_input(req: AtsScoreRequest) -> ScoringInput:
    all_bullets = [b for section in req.sections for b in section.bullets]
    # prefix each bullet with a consistent bullet char so format_scorer's
    # bullet-style-consistency check reflects reality: Resumake's LaTeX
    # template always renders one consistent bullet style.
    bullet_lines = [f"- {b.text}" for b in all_bullets]

    resume_text_parts = bullet_lines[:]
    if req.educationText.strip():
        resume_text_parts.append(req.educationText)
    if req.skills:
        resume_text_parts.append(", ".join(req.skills))
    resume_text = "\n".join(resume_text_parts)

    resume_sections: list[str] = []
    if req.hasContactInfo:
        resume_sections.append("contact")
    if any(s.kind == "job" for s in req.sections):
        resume_sections.append("experience")
    if any(s.kind == "project" for s in req.sections):
        resume_sections.append("projects")
    if req.educationText.strip():
        resume_sections.append("education")
    if req.skills:
        resume_sections.append("skills")
    if req.hasSummary:
        resume_sections.append("summary")

    word_count = len(resume_text.split())
    page_count = (
        max(1, math.ceil(word_count / _WORDS_PER_PAGE)) if word_count > 0 else 1
    )

    return ScoringInput(
        resumeText=resume_text,
        resumeSkills=req.skills,
        resumeSections=resume_sections,
        experienceBullets=[b.text for b in all_bullets],
        educationText=req.educationText,
        # Resumake generates resumes from structured data via its own
        # LaTeX pipeline (client-side lib/latexTemplate.ts): single
        # column, no \includegraphics, no real data tables, and
        # \pdfgentounicode=1 is set specifically for ATS parsability.
        # These three checks would always trivially pass for
        # Resumake-generated output, and we have no layout-inspection
        # code to make them meaningful for anything else (that lives in
        # ats-screener's excluded parser/ pipeline, out of scope here —
        # see resumake AGENTS.md task notes). Hardcoded False rather
        # than silently dropping the dimension: format_scorer.py still
        # runs its other checks (page/word count, special chars,
        # all-caps, bullet consistency) for real.
        hasMultipleColumns=False,
        hasTables=False,
        hasImages=False,
        pageCount=page_count,
        wordCount=word_count,
        jobDescription=req.jdText,
    )


@router.post("/analyze/ats-score", response_model=list[ScoreResult])
def ats_score(req: AtsScoreRequest) -> list[ScoreResult]:
    try:
        scoring_input = _build_scoring_input(req)
        return score_resume(scoring_input)
    except (
        Exception
    ) as err:  # deterministic scoring, no upstream/Ollama call to attribute failure to
        raise HTTPException(status_code=500, detail=str(err)) from err
