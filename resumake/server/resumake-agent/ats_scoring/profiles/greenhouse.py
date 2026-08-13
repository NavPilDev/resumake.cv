"""Greenhouse: modern ATS for tech/startups, lenient parsing, semantic
matching. Values experience quality and scorecards over keyword density.
Ported from ats-screener's scorer/profiles/greenhouse.ts."""

from __future__ import annotations

import re

from ..types import ATSProfile, ATSQuirk, ProfileWeights, QuirkResult, ScoringInput

_QUANTIFIED_RE = re.compile(r"\d+%|\$[\d,]+|\d+\s*(?:x|times)", re.IGNORECASE)


def _quantification_check(input: ScoringInput) -> QuirkResult | None:
    bullets = input.experienceBullets
    quantified_count = sum(1 for b in bullets if _QUANTIFIED_RE.search(b))
    quantified_ratio = quantified_count / max(1, len(bullets))

    if quantified_ratio >= 0.4:
        return QuirkResult(
            penalty=-8,
            message=(
                "strong quantification in experience bullets. Greenhouse scorecards "
                "reward measurable impact."
            ),
        )
    return None


def _projects_check(input: ScoringInput) -> QuirkResult | None:
    if "projects" in input.resumeSections:
        return QuirkResult(
            penalty=-3,
            message="projects section detected. Greenhouse hiring managers value seeing project work.",
        )
    return None


GREENHOUSE_PROFILE = ATSProfile(
    name="Greenhouse",
    vendor="Greenhouse Software",
    marketShare="top tech companies and startups",
    description="structured scorecards, semantic matching, lenient formatting",
    parsingStrictness=0.4,
    keywordStrategy="semantic",
    weights=ProfileWeights(
        formatting=0.1,
        keywordMatch=0.25,
        sectionCompleteness=0.1,
        experienceRelevance=0.25,
        educationMatch=0.1,
        quantification=0.2,
    ),
    requiredSections=["experience", "education"],
    preferredDateFormats=["Month YYYY", "MM/YYYY", "YYYY"],
    quirks=[
        ATSQuirk(
            id="greenhouse-quantification",
            description="Greenhouse structured scorecards reward measurable impact",
            check=_quantification_check,
        ),
        ATSQuirk(
            id="greenhouse-projects",
            description="Greenhouse values project work for technical roles",
            check=_projects_check,
        ),
    ],
    passingScore=55,
)
