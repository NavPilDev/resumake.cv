"""Pure comparison between two ATS scan result sets — "you went from X
to Y" deltas. Ported from ats-screener's scorer/comparison.ts.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .js_math import js_round
from .types import ScoreResult


@dataclass
class PlatformDelta:
    system: str
    previous: int
    current: int
    delta: int


@dataclass
class ScanComparison:
    previousAverage: int
    currentAverage: int
    deltaAverage: int
    previousPassing: int
    currentPassing: int
    deltaPassing: int
    platforms: list[PlatformDelta] = field(default_factory=list)
    improved: int = 0
    regressed: int = 0
    unchanged: int = 0


def _average(results: list[ScoreResult]) -> int:
    if not results:
        return 0
    return js_round(sum(r.overallScore for r in results) / len(results))


def _passing_count(results: list[ScoreResult]) -> int:
    return sum(1 for r in results if r.passesFilter)


def compute_scan_comparison(
    current: list[ScoreResult], previous: list[ScoreResult]
) -> ScanComparison | None:
    if not current or not previous:
        return None

    current_average = _average(current)
    previous_average = _average(previous)
    current_passing = _passing_count(current)
    previous_passing = _passing_count(previous)

    previous_by_system = {r.system: r.overallScore for r in previous}

    platforms: list[PlatformDelta] = []
    improved = 0
    regressed = 0
    unchanged = 0

    for curr in current:
        prev_score = previous_by_system.get(curr.system)
        if prev_score is None:
            continue
        delta = curr.overallScore - prev_score
        platforms.append(
            PlatformDelta(
                system=curr.system,
                previous=prev_score,
                current=curr.overallScore,
                delta=delta,
            )
        )
        if delta > 0:
            improved += 1
        elif delta < 0:
            regressed += 1
        else:
            unchanged += 1

    return ScanComparison(
        previousAverage=previous_average,
        currentAverage=current_average,
        deltaAverage=current_average - previous_average,
        previousPassing=previous_passing,
        currentPassing=current_passing,
        deltaPassing=current_passing - previous_passing,
        platforms=platforms,
        improved=improved,
        regressed=regressed,
        unchanged=unchanged,
    )
