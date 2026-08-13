"""Lever: ATS/CRM hybrid for startups, most lenient parser of the major
platforms. Contextual matching, values narrative quality over strict
keyword density. Ported from ats-screener's scorer/profiles/lever.ts."""

from __future__ import annotations

from ..types import ATSProfile, ATSQuirk, ProfileWeights, QuirkResult, ScoringInput


def _narrative_check(input: ScoringInput) -> QuirkResult | None:
    bullets = input.experienceBullets
    avg_bullet_length = (sum(len(b) for b in bullets) / len(bullets)) if bullets else 0

    if 60 <= avg_bullet_length <= 150:
        return QuirkResult(
            penalty=-5,
            message=(
                "well-detailed experience descriptions. Lever contextual matching "
                "works best with descriptive bullets."
            ),
        )
    return None


def _summary_check(input: ScoringInput) -> QuirkResult | None:
    if "summary" in input.resumeSections:
        return QuirkResult(
            penalty=-3,
            message="professional summary detected. Lever CRM uses this for candidate context.",
        )
    return None


LEVER_PROFILE = ATSProfile(
    name="Lever",
    vendor="Lever (Employ Inc.)",
    marketShare="popular with startups and mid-market tech",
    description="contextual matching, lenient parsing, values narrative quality",
    parsingStrictness=0.35,
    keywordStrategy="semantic",
    weights=ProfileWeights(
        formatting=0.08,
        keywordMatch=0.22,
        sectionCompleteness=0.1,
        experienceRelevance=0.3,
        educationMatch=0.1,
        quantification=0.2,
    ),
    requiredSections=["experience"],
    preferredDateFormats=["Month YYYY", "YYYY"],
    quirks=[
        ATSQuirk(
            id="lever-narrative",
            description="Lever values well-written experience descriptions",
            check=_narrative_check,
        ),
        ATSQuirk(
            id="lever-summary",
            description="Lever benefits from a professional summary",
            check=_summary_check,
        ),
    ],
    passingScore=50,
)
