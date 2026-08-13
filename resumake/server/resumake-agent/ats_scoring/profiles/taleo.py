"""Taleo: legacy Oracle ATS, boolean keyword filtering, knockout
questions. Rigid parsing with strict date and section requirements.
Ported from ats-screener's scorer/profiles/taleo.ts."""

from __future__ import annotations

from ..types import ATSProfile, ATSQuirk, ProfileWeights, QuirkResult, ScoringInput


def _keyword_density_check(input: ScoringInput) -> QuirkResult | None:
    if input.jobDescription and len(input.resumeSkills) < 5:
        return QuirkResult(
            penalty=10,
            message=(
                "very few skills detected. Taleo relies heavily on keyword matching. "
                "ensure your resume lists relevant skills explicitly."
            ),
        )
    return None


def _section_headers_check(input: ScoringInput) -> QuirkResult | None:
    standard_headers = ["contact", "experience", "education", "skills"]
    missing_standard = [h for h in standard_headers if h not in input.resumeSections]
    if len(missing_standard) > 1:
        return QuirkResult(
            penalty=8,
            message=f"missing standard sections: {', '.join(missing_standard)}. Taleo requires clearly labeled sections.",
        )
    return None


TALEO_PROFILE = ATSProfile(
    name="Taleo",
    vendor="Oracle Corporation",
    marketShare="~25% of Fortune 500",
    description="boolean keyword filtering, knockout questions, rigid parsing",
    parsingStrictness=0.85,
    keywordStrategy="exact",
    weights=ProfileWeights(
        formatting=0.2,
        keywordMatch=0.35,
        sectionCompleteness=0.15,
        experienceRelevance=0.15,
        educationMatch=0.1,
        quantification=0.05,
    ),
    requiredSections=["contact", "experience", "education", "skills"],
    preferredDateFormats=["MM/YYYY", "Month YYYY"],
    quirks=[
        ATSQuirk(
            id="taleo-keyword-density",
            description="Taleo uses boolean keyword matching with AND/OR logic",
            check=_keyword_density_check,
        ),
        ATSQuirk(
            id="taleo-section-headers",
            description="Taleo expects very standard section headers",
            check=_section_headers_check,
        ),
    ],
    passingScore=65,
)
