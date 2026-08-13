"""Scores section completeness based on the ATS profile's required
sections. Ported from ats-screener's scorer/section-scorer.ts."""

from __future__ import annotations

from dataclasses import dataclass, field

from .js_math import js_round


@dataclass
class SectionScore:
    score: int
    present: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)


def score_sections(present_sections: list[str], required_sections: list[str]) -> SectionScore:
    present_set = {s.lower() for s in present_sections}
    present: list[str] = []
    missing: list[str] = []

    for required in required_sections:
        if required.lower() in present_set:
            present.append(required)
        else:
            missing.append(required)

    score = js_round((len(present) / len(required_sections)) * 100) if required_sections else 100

    return SectionScore(score=score, present=present, missing=missing)
