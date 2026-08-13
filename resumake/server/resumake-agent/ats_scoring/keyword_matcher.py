"""Matches resume keywords against JD keywords using exact, fuzzy, or
semantic strategy — strategy reflects real ATS strictness (exact for
Workday/Taleo/SuccessFactors, fuzzy for iCIMS, semantic for
Greenhouse/Lever). Ported from ats-screener's scorer/keyword-matcher.ts.

quickKeywordScore (the other export of keyword-matcher.ts) isn't ported:
it backs a "no-JD scoring mode" that nothing in the ported engine calls,
and it depends on nlp/tfidf.ts's computeKeywordOverlap, which isn't
ported either for the same reason (see nlp_utils.py's module docstring).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from .js_math import js_round
from .nlp_utils import get_canonical, are_synonyms, tokenize


@dataclass
class KeywordMatchResult:
    score: int
    matched: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    synonymMatched: list[str] = field(default_factory=list)


def match_keywords(
    resume_text: str,
    job_description: str,
    strategy: Literal["exact", "fuzzy", "semantic"],
) -> KeywordMatchResult:
    if not job_description or not job_description.strip():
        return KeywordMatchResult(score=100)

    resume_tokens = tokenize(resume_text)
    jd_tokens = tokenize(job_description)

    resume_terms = {t.normalized for t in resume_tokens}
    # dict used as an ordered set, mirroring `[...new Set(...)]`'s insertion order
    jd_terms = list(dict.fromkeys(t.normalized for t in jd_tokens))

    resume_canonicals = {get_canonical(t.normalized) for t in resume_tokens}

    matched: list[str] = []
    missing: list[str] = []
    synonym_matched: list[str] = []

    resume_text_lower = resume_text.lower()

    for jd_term in jd_terms:
        if jd_term in resume_terms:
            matched.append(jd_term)
            continue

        if strategy == "exact":
            missing.append(jd_term)
            continue

        # fuzzy: check synonym database
        jd_canonical = get_canonical(jd_term)
        if jd_canonical in resume_canonicals:
            synonym_matched.append(jd_term)
            continue

        found_synonym = False
        for resume_term in resume_terms:
            if are_synonyms(resume_term, jd_term):
                synonym_matched.append(jd_term)
                found_synonym = True
                break
        if found_synonym:
            continue

        if strategy == "fuzzy":
            missing.append(jd_term)
            continue

        # semantic: partial string matching (contains, prefix)
        found_partial = False
        for resume_term in resume_terms:
            if resume_term in jd_term or jd_term in resume_term:
                if min(len(resume_term), len(jd_term)) >= 3:
                    synonym_matched.append(jd_term)
                    found_partial = True
                    break
        if found_partial:
            continue

        # also check the full resume text for multi-word JD terms
        if len(jd_term) >= 4 and jd_term in resume_text_lower:
            matched.append(jd_term)
            continue

        missing.append(jd_term)

    total_jd_terms = len(jd_terms)
    if total_jd_terms == 0:
        return KeywordMatchResult(score=100, matched=matched, missing=missing, synonymMatched=synonym_matched)

    # exact matches count full, synonym matches count 80%
    effective_matches = len(matched) + len(synonym_matched) * 0.8
    score = js_round(min(100, (effective_matches / total_jd_terms) * 100))

    return KeywordMatchResult(score=score, matched=matched, missing=missing, synonymMatched=synonym_matched)
