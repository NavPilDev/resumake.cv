"""iCIMS: mid-to-large enterprise ATS, AI-assisted fuzzy keyword
matching. More format-tolerant than Workday/Taleo, supports skills
taxonomies. Ported from ats-screener's scorer/profiles/icims.ts."""

from __future__ import annotations

from ..types import ATSProfile, ATSQuirk, ProfileWeights, QuirkResult, ScoringInput


def _skills_taxonomy_check(input: ScoringInput) -> QuirkResult | None:
    if len(input.resumeSkills) >= 10:
        return QuirkResult(
            penalty=-5,
            message=(
                "comprehensive skills list detected. iCIMS skill taxonomy matching "
                "benefits from detailed skill listings."
            ),
        )
    return None


ICIMS_PROFILE = ATSProfile(
    name="iCIMS",
    vendor="iCIMS, Inc.",
    marketShare="~15% of Fortune 500",
    description="AI-assisted matching, fuzzy keywords, more format-tolerant",
    parsingStrictness=0.6,
    keywordStrategy="fuzzy",
    weights=ProfileWeights(
        formatting=0.15,
        keywordMatch=0.3,
        sectionCompleteness=0.15,
        experienceRelevance=0.2,
        educationMatch=0.1,
        quantification=0.1,
    ),
    requiredSections=["contact", "experience", "education"],
    preferredDateFormats=["Month YYYY", "MM/YYYY", "YYYY"],
    quirks=[
        ATSQuirk(
            id="icims-skills-taxonomy",
            description="iCIMS uses a skills taxonomy for broader matching",
            check=_skills_taxonomy_check,
        ),
    ],
    passingScore=60,
)
