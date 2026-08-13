"""Score/profile shapes for the deterministic ATS-scoring engine
(ported from ats-screener's scorer/types.ts).

API-facing shapes (the request and everything that ends up in a
ScoreResult) are pydantic models, matching this codebase's existing
convention in ../models.py. ATSQuirk/ATSProfile/ScoringInput never
leave the server — a quirk's `check` is a plain Python callable, which
pydantic can't serialize — so those stay as dataclasses.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Literal

from pydantic import BaseModel, Field

from ..models import Section


class FormattingBreakdown(BaseModel):
    score: float
    issues: list[str]
    details: list[str]


class KeywordMatchBreakdown(BaseModel):
    score: int
    matched: list[str]
    missing: list[str]
    synonymMatched: list[str]


class SectionsBreakdown(BaseModel):
    score: int
    present: list[str]
    missing: list[str]


class ExperienceBreakdown(BaseModel):
    score: int
    quantifiedBullets: int
    totalBullets: int
    actionVerbCount: int
    highlights: list[str]


class EducationBreakdown(BaseModel):
    score: int
    notes: list[str]


class ScoreBreakdown(BaseModel):
    formatting: FormattingBreakdown
    keywordMatch: KeywordMatchBreakdown
    sections: SectionsBreakdown
    experience: ExperienceBreakdown
    education: EducationBreakdown


class StructuredSuggestion(BaseModel):
    summary: str
    details: list[str] = Field(default_factory=list)
    impact: Literal["critical", "high", "medium", "low"]
    platforms: list[str] = Field(default_factory=list)


# Suggestion = string | StructuredSuggestion in the original. The engine
# (engine.ts's generateSuggestions) only ever emits plain strings today —
# StructuredSuggestion exists for future use (e.g. quick-wins) — so the
# response type mirrors that union.
Suggestion = str | StructuredSuggestion


class ScoreResult(BaseModel):
    system: str
    vendor: str
    overallScore: int
    passesFilter: bool
    breakdown: ScoreBreakdown
    suggestions: list[Suggestion]


@dataclass
class ScoringInput:
    resumeText: str
    resumeSkills: list[str]
    resumeSections: list[str]
    experienceBullets: list[str]
    educationText: str
    hasMultipleColumns: bool
    hasTables: bool
    hasImages: bool
    pageCount: int
    wordCount: int
    jobDescription: str | None = None


@dataclass
class QuirkResult:
    penalty: float
    message: str


@dataclass
class ATSQuirk:
    id: str
    description: str
    check: Callable[[ScoringInput], QuirkResult | None]


@dataclass
class ProfileWeights:
    formatting: float
    keywordMatch: float
    sectionCompleteness: float
    experienceRelevance: float
    educationMatch: float
    quantification: float


@dataclass
class ATSProfile:
    name: str
    vendor: str
    marketShare: str
    description: str
    parsingStrictness: float
    keywordStrategy: Literal["exact", "fuzzy", "semantic"]
    weights: ProfileWeights
    requiredSections: list[str]
    preferredDateFormats: list[str]
    quirks: list[ATSQuirk]
    passingScore: int


class AtsScoreRequest(BaseModel):
    """Request for POST /ollama/analyze/ats-score.

    Built client-side from the user's saved experience data (see
    ../../client/lib/atsScore.ts) rather than from an uploaded file —
    sections are reused as-is from ../models.py, education/skills are
    flattened to plain text/a flat list by the client.
    """

    sections: list[Section]
    educationText: str = ""
    skills: list[str] = Field(default_factory=list)
    hasContactInfo: bool = True
    hasSummary: bool = False
    jdText: str = ""
