"""SuccessFactors: enterprise HCM by SAP, rigid field mapping, exact
keyword matching. Expects standard formatting and structured sections,
date-sensitive. Ported from ats-screener's scorer/profiles/successfactors.ts."""

from __future__ import annotations

import re

from ..types import ATSProfile, ATSQuirk, ProfileWeights, QuirkResult, ScoringInput

_YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")


def _structured_data_check(input: ScoringInput) -> QuirkResult | None:
    # penalize if critical structured data is missing
    has_dates = bool(_YEAR_RE.search(input.resumeText))
    has_company_names = len(input.experienceBullets) > 0

    if not has_dates:
        return QuirkResult(
            penalty=10,
            message="no dates detected. SuccessFactors requires structured date fields for each position.",
        )
    if not has_company_names:
        return QuirkResult(
            penalty=8,
            message="no clear experience entries detected. SuccessFactors needs structured employer/title/date fields.",
        )
    return None


def _section_structure_check(input: ScoringInput) -> QuirkResult | None:
    required = ["contact", "experience", "education", "skills"]
    missing = [r for r in required if r not in input.resumeSections]
    if missing:
        return QuirkResult(
            penalty=len(missing) * 5,
            message=f"missing sections: {', '.join(missing)}. SuccessFactors requires structured sections for field mapping.",
        )
    return None


SUCCESSFACTORS_PROFILE = ATSProfile(
    name="SuccessFactors",
    vendor="SAP SE",
    marketShare="~15% of large enterprise",
    description="enterprise structured parsing, rigid field mapping, exact matching",
    parsingStrictness=0.85,
    keywordStrategy="exact",
    weights=ProfileWeights(
        formatting=0.25,
        keywordMatch=0.25,
        sectionCompleteness=0.2,
        experienceRelevance=0.15,
        educationMatch=0.1,
        quantification=0.05,
    ),
    requiredSections=["contact", "experience", "education", "skills"],
    preferredDateFormats=["MM/YYYY", "DD/MM/YYYY"],
    quirks=[
        ATSQuirk(
            id="sf-structured-data",
            description="SuccessFactors maps resume fields to structured SAP data",
            check=_structured_data_check,
        ),
        ATSQuirk(
            id="sf-section-structure",
            description="SuccessFactors requires all standard sections",
            check=_section_structure_check,
        ),
    ],
    passingScore=65,
)
