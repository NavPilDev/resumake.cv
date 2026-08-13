"""Quick-wins picker: surfaces the top N highest-impact structured
suggestions across every ATS profile, deduplicated by summary text.
Ported from ats-screener's scorer/quick-wins.ts.
"""

from __future__ import annotations

from .types import ScoreResult, StructuredSuggestion, Suggestion

_IMPACT_RANK: dict[str, int] = {"critical": 4, "high": 3, "medium": 2, "low": 1}


def _is_structured(suggestion: Suggestion) -> bool:
    return isinstance(suggestion, StructuredSuggestion) and len(suggestion.summary) > 0


def pick_quick_wins(
    results: list[ScoreResult], limit: int = 3
) -> list[StructuredSuggestion]:
    if limit <= 0:
        return []

    collected: list[StructuredSuggestion] = []
    seen: set[str] = set()

    for result in results:
        for suggestion in result.suggestions:
            if not _is_structured(suggestion):
                continue
            key = suggestion.summary.strip().lower()
            if key in seen:
                continue
            seen.add(key)
            collected.append(suggestion)

    # stable sort by impact rank descending (Python's sort is stable,
    # matching JS's guaranteed-stable Array.prototype.sort since ES2019)
    collected.sort(key=lambda s: _IMPACT_RANK.get(s.impact, 0), reverse=True)

    return collected[:limit]
