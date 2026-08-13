"""Score classification tiers, single source of truth for score-to-
label/color mapping. Ported from ats-screener's scorer/classification.ts."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

ScoreTier = Literal["excellent", "good", "fair", "poor"]


@dataclass
class ScoreClassification:
    tier: ScoreTier
    label: str
    color: str


_TIERS: list[tuple[int, ScoreTier, str, str]] = [
    (80, "excellent", "Excellent", "#22c55e"),
    (60, "good", "Good", "#eab308"),
    (40, "fair", "Needs Work", "#f97316"),
    (0, "poor", "Poor", "#ef4444"),
]


def classify_score(score: int) -> ScoreClassification:
    for minimum, tier, label, color in _TIERS:
        if score >= minimum:
            return ScoreClassification(tier=tier, label=label, color=color)
    return ScoreClassification(tier="poor", label="Poor", color="#ef4444")


def get_score_label(score: int) -> str:
    return classify_score(score).label


def get_score_color(score: int) -> str:
    return classify_score(score).color
