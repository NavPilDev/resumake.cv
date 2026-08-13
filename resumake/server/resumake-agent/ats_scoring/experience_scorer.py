"""Scores experience quality: quantified achievements, action verbs,
bullet density. Ported from ats-screener's scorer/experience-scorer.ts."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .js_math import js_round

# strong action verbs that ATS systems and recruiters look for in bullet points
STRONG_ACTION_VERBS = {
    "achieved", "accelerated", "administered", "advanced", "analyzed",
    "architected", "automated", "built", "centralized", "championed",
    "collaborated", "conceptualized", "consolidated", "contributed",
    "converted", "coordinated", "created", "decreased", "delivered",
    "designed", "developed", "directed", "drove", "eliminated", "enabled",
    "engineered", "established", "exceeded", "executed", "expanded",
    "facilitated", "founded", "generated", "grew", "headed", "identified",
    "implemented", "improved", "increased", "influenced", "initiated",
    "innovated", "integrated", "introduced", "launched", "led",
    "leveraged", "managed", "maximized", "mentored", "migrated",
    "modernized", "negotiated", "operated", "optimized", "orchestrated",
    "organized", "outperformed", "overhauled", "oversaw", "pioneered",
    "planned", "presented", "prioritized", "produced", "programmed",
    "proposed", "published", "raised", "recommended", "redesigned",
    "reduced", "refactored", "reformed", "re-engineered", "reorganized",
    "replaced", "researched", "resolved", "restructured", "revamped",
    "revolutionized", "scaled", "secured", "simplified", "spearheaded",
    "standardized", "streamlined", "strengthened", "supervised",
    "surpassed", "synchronized", "trained", "transformed", "translated",
    "unified", "upgraded",
}

# patterns indicating quantified achievements (measurable impact boosts ATS scores)
QUANTIFICATION_PATTERNS = [
    re.compile(r"\d+%"),  # percentages: "increased by 30%"
    re.compile(r"\$[\d,]+"),  # dollar amounts: "$1.2M"
    re.compile(r"\d+\s*(?:x|times)", re.IGNORECASE),  # multipliers: "3x improvement"
    re.compile(r"\d+\+?\s*(?:users?|customers?|clients?|employees?|members?|team)", re.IGNORECASE),  # people counts
    re.compile(r"\d+\+?\s*(?:projects?|products?|applications?|systems?|services?)", re.IGNORECASE),  # thing counts
    re.compile(r"(?:top|first|#)\s*\d+", re.IGNORECASE),  # rankings: "top 5%", "#1"
    re.compile(r"\d+\s*(?:hours?|days?|weeks?|months?|years?)", re.IGNORECASE),  # time durations
    re.compile(r"\d{1,3}(?:,\d{3})+"),  # large numbers: "100,000"
    re.compile(r"\d+\s*(?:million|billion|thousand|k|m|b)\b", re.IGNORECASE),  # scaled numbers
]

_FIRST_WORD_CLEAN_RE = re.compile(r"[^a-z]")


@dataclass
class ExperienceScore:
    score: int
    quantifiedBullets: int
    totalBullets: int
    actionVerbCount: int
    highlights: list[str] = field(default_factory=list)


def score_experience(bullets: list[str]) -> ExperienceScore:
    if not bullets:
        return ExperienceScore(
            score=0,
            quantifiedBullets=0,
            totalBullets=0,
            actionVerbCount=0,
            highlights=["no experience bullets found"],
        )

    highlights: list[str] = []
    quantified_bullets = 0
    action_verb_count = 0

    for bullet in bullets:
        if any(p.search(bullet) for p in QUANTIFICATION_PATTERNS):
            quantified_bullets += 1

        words = bullet.strip().split()
        first_word = _FIRST_WORD_CLEAN_RE.sub("", words[0].lower()) if words else ""
        if first_word and first_word in STRONG_ACTION_VERBS:
            action_verb_count += 1

    total_bullets = len(bullets)

    quantification_ratio = quantified_bullets / total_bullets
    action_verb_ratio = action_verb_count / total_bullets

    # ideal: 40%+ quantified, 70%+ action verbs
    quant_score = min(1, quantification_ratio / 0.4) * 40
    action_score = min(1, action_verb_ratio / 0.7) * 30

    # bullet count: penalize too few, reward good amount
    if total_bullets >= 8:
        bullet_count_score = 30
    elif total_bullets >= 5:
        bullet_count_score = 25
    elif total_bullets >= 3:
        bullet_count_score = 20
    else:
        bullet_count_score = 10

    if quantification_ratio >= 0.4:
        highlights.append(f"{js_round(quantification_ratio * 100)}% of bullets are quantified (excellent)")
    elif quantification_ratio >= 0.2:
        highlights.append(f"{js_round(quantification_ratio * 100)}% of bullets are quantified (good, aim for 40%+)")
    else:
        highlights.append(
            f"only {js_round(quantification_ratio * 100)}% of bullets are quantified "
            "(add numbers, percentages, dollar amounts)"
        )

    if action_verb_ratio >= 0.7:
        highlights.append("strong use of action verbs")
    else:
        highlights.append(f"{js_round(action_verb_ratio * 100)}% bullets start with action verbs (aim for 70%+)")

    if total_bullets < 5:
        highlights.append(f"only {total_bullets} experience bullets. consider adding more detail.")

    score = js_round(min(100, quant_score + action_score + bullet_count_score))

    return ExperienceScore(
        score=score,
        quantifiedBullets=quantified_bullets,
        totalBullets=total_bullets,
        actionVerbCount=action_verb_count,
        highlights=highlights,
    )
