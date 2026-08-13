"""Orchestrator: scores a resume against all 6 ATS profiles. Deterministic
— same input always produces the same output. Ported from ats-screener's
scorer/engine.ts."""

from __future__ import annotations

from dataclasses import dataclass

from .education_scorer import score_education
from .experience_scorer import score_experience
from .format_scorer import score_formatting
from .js_math import js_round
from .keyword_matcher import match_keywords
from .profiles import ALL_PROFILES
from .section_scorer import score_sections
from .types import (
    ATSProfile,
    EducationBreakdown,
    ExperienceBreakdown,
    FormattingBreakdown,
    KeywordMatchBreakdown,
    ScoreBreakdown,
    ScoreResult,
    ScoringInput,
    SectionsBreakdown,
)


def score_resume(input: ScoringInput) -> list[ScoreResult]:
    return [score_against_profile(input, profile) for profile in ALL_PROFILES]


def score_against_profile(input: ScoringInput, profile: ATSProfile) -> ScoreResult:
    breakdown = _compute_breakdown(input, profile)
    weighted_score = _compute_weighted_score(breakdown, profile)

    total_adjustment, quirk_messages = _compute_quirk_adjustment(input, profile)
    overall_score = max(0, min(100, js_round(weighted_score + total_adjustment)))

    suggestions = _generate_suggestions(breakdown, profile, quirk_messages)

    return ScoreResult(
        system=profile.name,
        vendor=profile.vendor,
        overallScore=overall_score,
        passesFilter=overall_score >= profile.passingScore,
        breakdown=breakdown,
        suggestions=suggestions,
    )


def _compute_breakdown(input: ScoringInput, profile: ATSProfile) -> ScoreBreakdown:
    formatting = score_formatting(input, profile.parsingStrictness)
    sections = score_sections(input.resumeSections, profile.requiredSections)
    experience = score_experience(input.experienceBullets)
    education = score_education(input.educationText)
    keywords = match_keywords(input.resumeText, input.jobDescription or "", profile.keywordStrategy)

    return ScoreBreakdown(
        formatting=FormattingBreakdown(score=formatting.score, issues=formatting.issues, details=formatting.details),
        keywordMatch=KeywordMatchBreakdown(
            score=keywords.score,
            matched=keywords.matched,
            missing=keywords.missing,
            synonymMatched=keywords.synonymMatched,
        ),
        sections=SectionsBreakdown(score=sections.score, present=sections.present, missing=sections.missing),
        experience=ExperienceBreakdown(
            score=experience.score,
            quantifiedBullets=experience.quantifiedBullets,
            totalBullets=experience.totalBullets,
            actionVerbCount=experience.actionVerbCount,
            highlights=experience.highlights,
        ),
        education=EducationBreakdown(score=education.score, notes=education.notes),
    )


def _compute_weighted_score(breakdown: ScoreBreakdown, profile: ATSProfile) -> float:
    weights = profile.weights

    # quantification is derived from the experience scorer's quantification ratio
    quantification_score = (
        js_round((breakdown.experience.quantifiedBullets / breakdown.experience.totalBullets) * 100)
        if breakdown.experience.totalBullets > 0
        else 0
    )

    return (
        breakdown.formatting.score * weights.formatting
        + breakdown.keywordMatch.score * weights.keywordMatch
        + breakdown.sections.score * weights.sectionCompleteness
        + breakdown.experience.score * weights.experienceRelevance
        + breakdown.education.score * weights.educationMatch
        + quantification_score * weights.quantification
    )


def _compute_quirk_adjustment(input: ScoringInput, profile: ATSProfile) -> tuple[float, list[str]]:
    total_adjustment = 0.0
    messages: list[str] = []

    for quirk in profile.quirks:
        result = quirk.check(input)
        if result:
            total_adjustment -= result.penalty
            messages.append(result.message)

    return total_adjustment, messages


def _generate_suggestions(breakdown: ScoreBreakdown, profile: ATSProfile, quirk_messages: list[str]) -> list[str]:
    suggestions: list[str] = []

    # formatting suggestions
    if breakdown.formatting.score < 70:
        if any("multi-column" in i for i in breakdown.formatting.issues):
            suggestions.append("switch to a single-column resume layout for better ATS parsing")
        if any("tables" in i for i in breakdown.formatting.issues):
            suggestions.append("remove tables and use plain text formatting instead")
        if any("images" in i for i in breakdown.formatting.issues):
            suggestions.append("remove images, logos, and graphics from your resume")

    # keyword suggestions
    if breakdown.keywordMatch.score < 60 and len(breakdown.keywordMatch.missing) > 0:
        top_missing = breakdown.keywordMatch.missing[:5]
        suggestions.append(f"add these missing keywords from the job description: {', '.join(top_missing)}")

        if profile.keywordStrategy == "exact":
            suggestions.append(
                f"{profile.name} uses exact keyword matching. use the exact terms from the job "
                "posting, not synonyms."
            )

    # section suggestions
    if len(breakdown.sections.missing) > 0:
        suggestions.append(
            f"add missing sections: {', '.join(breakdown.sections.missing)}. "
            f"{profile.name} requires these for proper parsing."
        )

    # experience suggestions
    if breakdown.experience.totalBullets > 0:
        quant_ratio = breakdown.experience.quantifiedBullets / breakdown.experience.totalBullets
        if quant_ratio < 0.3:
            suggestions.append(
                "add more quantified achievements (numbers, percentages, dollar amounts) to your "
                "experience bullets"
            )
        if breakdown.experience.actionVerbCount / breakdown.experience.totalBullets < 0.5:
            suggestions.append(
                "start more bullet points with strong action verbs (led, developed, increased, delivered)"
            )
    else:
        suggestions.append("add detailed experience bullets with measurable achievements")

    # education suggestions
    if breakdown.education.score < 50:
        suggestions.append("ensure your education section includes degree type, institution, and graduation date")

    # quirk-specific suggestions (from profile checks)
    suggestions.extend(quirk_messages)

    return suggestions
