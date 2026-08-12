"""Keyword/term matching (ported from lib/keywords.ts + lib/stopwords.ts —
only what gap-dedup needs, not the full keyword-mode scoring pipeline)."""

from __future__ import annotations

import re

from .models import Section

STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an",
    "and", "any", "are", "as", "at", "be", "because", "been", "before",
    "being", "below", "between", "both", "but", "by", "can", "cannot",
    "could", "did", "do", "does", "doing", "down", "during", "each", "few",
    "for", "from", "further", "had", "has", "have", "having", "he", "her",
    "here", "hers", "herself", "him", "himself", "his", "how", "i", "if",
    "in", "into", "is", "it", "its", "itself", "let", "me", "more", "most",
    "must", "my", "myself", "no", "nor", "not", "of", "off", "on", "once",
    "only", "or", "other", "ought", "our", "ours", "ourselves", "out",
    "over", "own", "same", "she", "should", "so", "some", "such", "than",
    "that", "the", "their", "theirs", "them", "themselves", "then", "there",
    "these", "they", "this", "those", "through", "to", "too", "under",
    "until", "up", "very", "was", "we", "were", "what", "when", "where",
    "which", "while", "who", "whom", "why", "will", "with", "would", "you",
    "your", "yours", "yourself", "yourselves", "etc",
    # job-posting filler
    "experience", "years", "year", "strong", "ability", "abilities",
    "skills", "skill", "knowledge", "including", "plus", "preferred",
    "required", "requirement", "requirements", "responsibilities",
    "responsibility", "job", "role", "roles", "position", "positions",
    "candidate", "candidates", "work", "works", "working", "environment",
    "team", "teams", "company", "companies", "opportunity", "opportunities",
    "looking", "join", "using", "use", "used", "help", "helping", "ensure",
    "ensuring", "provide", "providing", "new", "across", "within", "related",
    "similar", "various", "ideal", "ideally", "minimum", "maximum",
    "benefits", "salary", "equal", "employer", "apply", "application",
    "applicants", "please", "employment", "location", "based",
    "e.g", "eg", "i.e", "ie", "etc.", "bonus", "points", "highly", "desired",
    "familiarity", "intern", "build", "driven", "applications",
}

_STRIP_SEPARATORS_RE = re.compile(r"[-_/]")
_STRIP_NON_MATCH_CHARS_RE = re.compile(r"[^a-z0-9+#. ]")
_COLLAPSE_WHITESPACE_RE = re.compile(r"\s+")


def humanize_tag(tag: str) -> str:
    return tag.replace("-", " ")


def normalize_for_match(text: str) -> str:
    text = text.lower()
    text = _STRIP_SEPARATORS_RE.sub(" ", text)
    text = _STRIP_NON_MATCH_CHARS_RE.sub(" ", text)
    text = _COLLAPSE_WHITESPACE_RE.sub(" ", text)
    return text.strip()


def pad(normalized: str) -> str:
    return f" {normalized} "


def term_included(padded_normalized_haystack: str, term: str) -> bool:
    norm_term = normalize_for_match(term.replace("-", " "))
    if not norm_term:
        return False
    return f" {norm_term} " in padded_normalized_haystack


def tokenize(text: str) -> list[str]:
    return [t for t in normalize_for_match(text).split(" ") if t]


def build_bullet_haystack(sections: list[Section]) -> str:
    all_bullets = [b for s in sections for b in s.bullets]
    joined = " ".join(f"{' '.join(b.tags)} {b.text}" for b in all_bullets)
    return pad(normalize_for_match(joined))
