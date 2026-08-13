"""Scores education section: degree, institution, dates, GPA, honors.
Ported from ats-screener's scorer/education-scorer.ts."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

DEGREE_LEVELS: dict[str, int] = {
    "phd": 5,
    "ph.d": 5,
    "doctor": 5,
    "doctorate": 5,
    "master": 4,
    "master's": 4,
    "mba": 4,
    "ms": 4,
    "m.s": 4,
    "ma": 4,
    "m.a": 4,
    "m.b.a": 4,
    "bachelor": 3,
    "bachelor's": 3,
    "bs": 3,
    "b.s": 3,
    "ba": 3,
    "b.a": 3,
    "b.eng": 3,
    "associate": 2,
    "associate's": 2,
    "as": 2,
    "a.s": 2,
    "aa": 2,
    "a.a": 2,
    "diploma": 1,
    "certificate": 1,
    "certification": 1,
}

_INSTITUTION_RE = re.compile(r"[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)+")
_YEAR_RE = re.compile(r"\b(19|20)\d{2}\b")
_FIELD_INDICATOR_RE = re.compile(r"\b(?:in|of)\s+[A-Z]")
_FIELD_NAMES_RE = re.compile(
    r"(?:computer science|engineering|business|mathematics|biology|chemistry|physics|"
    r"psychology|economics|finance|accounting|marketing|nursing|law|education|design)",
    re.IGNORECASE,
)
_GPA_LABEL_RE = re.compile(r"\bgpa\b", re.IGNORECASE)
_GPA_FRACTION_RE = re.compile(r"\b[34]\.\d{1,2}\s*/?\s*4", re.IGNORECASE)
_GPA_VALUE_RE = re.compile(r"(\d\.\d{1,2})")
_HONORS_RE = re.compile(
    r"\b(cum laude|magna cum laude|summa cum laude|dean'?s?\s*list|honors?|distinction)\b",
    re.IGNORECASE,
)


@dataclass
class EducationScore:
    score: int
    notes: list[str] = field(default_factory=list)


def score_education(education_text: str) -> EducationScore:
    if not education_text or not education_text.strip():
        return EducationScore(
            score=20,
            notes=["no education section found. most positions require at least a degree listing."],
        )

    notes: list[str] = []
    score = 0
    lower_text = education_text.lower()

    # check for degree mention
    highest_degree = 0
    degree_found = ""
    for degree, level in DEGREE_LEVELS.items():
        if degree in lower_text and level > highest_degree:
            highest_degree = level
            degree_found = degree

    if highest_degree > 0:
        score += 30
        notes.append(f"degree detected: {degree_found}")
    else:
        notes.append("no clear degree type found. ensure your degree is explicitly stated.")

    # check for institution name (heuristic: capitalized multi-word phrase)
    if _INSTITUTION_RE.search(education_text):
        score += 20
    else:
        notes.append("institution name may not be clearly parseable")

    # check for dates
    if _YEAR_RE.search(education_text):
        score += 15
    else:
        notes.append("no graduation date found. include your graduation year.")

    # check for field of study
    has_field = bool(_FIELD_INDICATOR_RE.search(education_text)) or bool(
        _FIELD_NAMES_RE.search(education_text)
    )
    if has_field:
        score += 15
        notes.append("field of study detected")
    else:
        notes.append("consider explicitly stating your field of study")

    # check for GPA
    has_gpa = bool(_GPA_LABEL_RE.search(education_text)) or bool(_GPA_FRACTION_RE.search(education_text))
    if has_gpa:
        score += 10
        notes.append("GPA listed")
        gpa_match = _GPA_VALUE_RE.search(education_text)
        if gpa_match:
            gpa = float(gpa_match.group(1))
            if gpa >= 3.5:
                notes.append(f"strong GPA ({gpa})")
            elif gpa < 3.0:
                notes.append("consider removing GPA below 3.0 unless required")

    # check for honors
    if _HONORS_RE.search(education_text):
        score += 10
        notes.append("academic honors detected")

    return EducationScore(score=min(100, score), notes=notes)
