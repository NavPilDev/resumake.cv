"""Scores resume formatting and parseability; strict ATS systems
penalize heavily. Ported from ats-screener's scorer/format-scorer.ts.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .js_math import js_round
from .types import ScoringInput

_SPECIAL_CHAR_RE = re.compile(r"[^\w\s.,;:!?@#$%&*()\-+=/\\'\"]")
_BULLET_LINE_RE = re.compile(r"^\s*[-•*·▪►➤○●]\s")
_BULLET_CHAR_RE = re.compile(r"^\s*([-•*·▪►➤○●])")


@dataclass
class FormatScore:
    # NOT necessarily an integer: unlike the other 4 dimensions (which
    # all round before returning), the original's formatting score is
    # `100 - deductions` with no rounding — deductions accumulate as
    # `penalty * strictness` (e.g. 15 * 0.9), so this is routinely
    # fractional. Rounding here would drift the weighted sum in
    # engine.py before its own final rounding. Only individual penalty
    # amounts shown in `details` messages are rounded (via js_round),
    # matching the original's Math.round(penalty) call sites exactly.
    score: float
    issues: list[str] = field(default_factory=list)
    details: list[str] = field(default_factory=list)


def score_formatting(input: ScoringInput, strictness: float) -> FormatScore:
    issues: list[str] = []
    details: list[str] = []
    deductions = 0.0

    # multi-column layout detection
    if input.hasMultipleColumns:
        penalty = 15 * strictness
        deductions += penalty
        issues.append("multi-column layout detected")
        details.append(
            f"multi-column layouts confuse most ATS parsers. text may be read out of order. (-{js_round(penalty)})"
        )

    # table detection
    if input.hasTables:
        penalty = 12 * strictness
        deductions += penalty
        issues.append("tables detected in resume")
        details.append(
            "tables are poorly supported by many ATS systems. content inside tables may be "
            f"skipped entirely. (-{js_round(penalty)})"
        )

    # image detection
    if input.hasImages:
        penalty = 8 * strictness
        deductions += penalty
        issues.append("images or graphics detected")
        details.append(
            "ATS systems cannot read text embedded in images. logos, icons, and headshots add "
            f"no value. (-{js_round(penalty)})"
        )

    # page count
    if input.pageCount > 2:
        penalty = 5 * strictness
        deductions += penalty
        issues.append(f"resume is {input.pageCount} pages")
        details.append(
            f"most ATS systems and recruiters prefer 1-2 pages. longer resumes may be truncated. (-{js_round(penalty)})"
        )

    # word count (too short or too long)
    if input.wordCount < 150:
        penalty = 10 * strictness
        deductions += penalty
        issues.append("resume appears very short")
        details.append(
            f"only {input.wordCount} words detected. this may indicate parsing issues or "
            f"insufficient content. (-{js_round(penalty)})"
        )
    elif input.wordCount > 1500:
        penalty = 3 * strictness
        deductions += penalty
        issues.append("resume is quite long")
        details.append(
            f"{input.wordCount} words is above average. consider trimming to the most relevant content. (-{js_round(penalty)})"
        )

    # check for common formatting red flags in text
    text = input.resumeText

    # excessive special characters (often from bad PDF extraction)
    special_char_ratio = len(_SPECIAL_CHAR_RE.findall(text)) / len(text) if text else 0
    if special_char_ratio > 0.05:
        penalty = 8 * strictness
        deductions += penalty
        issues.append("unusual characters detected")
        details.append(
            "high density of special characters suggests formatting issues or encoding "
            f"problems. (-{js_round(penalty)})"
        )

    # all-caps sections (besides headers)
    lines = text.split("\n")
    all_caps_lines = [
        l
        for l in lines
        if len(l.strip()) > 30 and l == l.upper() and re.search(r"[A-Z]", l)
    ]
    if len(all_caps_lines) > 3:
        penalty = 3 * strictness
        deductions += penalty
        issues.append("excessive use of all-caps text")
        details.append(
            f"{len(all_caps_lines)} lines are fully uppercase. this can cause parsing confusion. (-{js_round(penalty)})"
        )

    # check for consistent bullet point usage
    bullet_lines = [l for l in lines if _BULLET_LINE_RE.match(l)]
    bullet_types = set()
    for l in bullet_lines:
        m = _BULLET_CHAR_RE.match(l)
        if m:
            bullet_types.add(m.group(1))
    if len(bullet_types) > 2:
        penalty = 2 * strictness
        deductions += penalty
        issues.append("inconsistent bullet point styles")
        details.append(
            f"{len(bullet_types)} different bullet styles detected. use a consistent format. (-{js_round(penalty)})"
        )

    # positive signals
    if not input.hasMultipleColumns and not input.hasTables and not input.hasImages:
        details.append("clean single-column layout detected (good)")
    if input.pageCount <= 2:
        details.append("appropriate page length (good)")
    if 300 <= input.wordCount <= 800:
        details.append("word count is in the ideal range (good)")

    score = max(0.0, min(100.0, 100 - deductions))

    return FormatScore(score=score, issues=issues, details=details)
