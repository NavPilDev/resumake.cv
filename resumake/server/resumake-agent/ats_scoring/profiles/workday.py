"""Workday: most-used ATS in Fortune 500, strict parsing, exact keyword
matching. Prefers single-column chronological resumes with clear section
headers. Ported from ats-screener's scorer/profiles/workday.ts."""

from __future__ import annotations

from ..types import ATSProfile, ATSQuirk, ProfileWeights, QuirkResult, ScoringInput


def _header_format_check(input: ScoringInput) -> QuirkResult | None:
    non_standard = [s for s in input.resumeSections if s == "unknown"]
    if len(non_standard) > 2:
        return QuirkResult(
            penalty=5,
            message=(
                'multiple unrecognized section headers. Workday expects standard names '
                'like "Experience", "Education", "Skills".'
            ),
        )
    return None


def _page_limit_check(input: ScoringInput) -> QuirkResult | None:
    if input.pageCount > 2:
        return QuirkResult(
            penalty=8,
            message=f"resume is {input.pageCount} pages. Workday may truncate content beyond page 2.",
        )
    return None


WORKDAY_PROFILE = ATSProfile(
    name="Workday",
    vendor="Workday, Inc.",
    marketShare="~40% of Fortune 500",
    description="strict parser, exact keyword matching, demands clean formatting",
    parsingStrictness=0.9,
    keywordStrategy="exact",
    weights=ProfileWeights(
        formatting=0.25,
        keywordMatch=0.3,
        sectionCompleteness=0.15,
        experienceRelevance=0.15,
        educationMatch=0.1,
        quantification=0.05,
    ),
    requiredSections=["contact", "experience", "education", "skills"],
    preferredDateFormats=["MM/YYYY", "Month YYYY"],
    quirks=[
        ATSQuirk(
            id="workday-header-format",
            description="Workday expects standard section header names",
            check=_header_format_check,
        ),
        ATSQuirk(
            id="workday-page-limit",
            description="Workday may truncate resumes beyond 2 pages",
            check=_page_limit_check,
        ),
    ],
    passingScore=70,
)
