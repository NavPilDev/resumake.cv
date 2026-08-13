"""Tokenization and synonym-canonicalization used by keyword_matcher.py.

Ported from ats-screener's nlp/tokenizer.ts and nlp/synonyms.ts — the
only two nlp/ files keyword-matcher.ts actually imports (nlp/tfidf.ts
backs quickKeywordScore, which nothing in the ported scoring path
calls, so it's not ported here; nlp/skills-taxonomy.ts backs the
excluded job-parser pipeline). No `compromise` or other NLP library is
used anywhere in this dependency chain — it's pure regex/set logic,
consistent with this codebase's existing text-matching convention in
../keywords.py.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# generic English stop words, ported verbatim from tokenizer.ts's STOP_WORDS
STOP_WORDS = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
    "been", "being", "have", "has", "had", "do", "does", "did", "will",
    "would", "could", "should", "may", "might", "shall", "can", "need",
    "not", "no", "nor", "so", "if", "then", "than", "too", "very", "just",
    "about", "above", "after", "again", "all", "also", "am", "any",
    "because", "before", "between", "both", "each", "few", "further",
    "get", "got", "here", "how", "i", "into", "it", "its", "me", "more",
    "most", "my", "myself", "now", "only", "other", "our", "out", "over",
    "own", "same", "she", "he", "her", "him", "his", "some", "such",
    "that", "their", "them", "there", "these", "they", "this", "those",
    "through", "under", "until", "up", "us", "we", "what", "when",
    "where", "which", "while", "who", "whom", "why", "you", "your",
    "etc", "ie", "eg", "per", "via",
}

_SPLIT_RE = re.compile(r"[\s,;|]+")
_STRIP_EDGE_PUNCT_RE = re.compile(r"^[^a-zA-Z0-9#+]+|[^a-zA-Z0-9#+]+$")


@dataclass
class Token:
    raw: str
    normalized: str
    position: int


def tokenize(text: str) -> list[Token]:
    """Lowercase, strip punctuation, filter stop words. Ported from
    tokenizer.ts's tokenize()."""
    words = _SPLIT_RE.split(text)
    tokens: list[Token] = []

    for i, raw in enumerate(words):
        # strip leading/trailing punctuation but preserve internal hyphens/dots
        cleaned = _STRIP_EDGE_PUNCT_RE.sub("", raw)
        if not cleaned:
            continue

        normalized = cleaned.lower()
        if normalized in STOP_WORDS:
            continue
        if len(normalized) < 2:
            continue

        tokens.append(Token(raw=cleaned, normalized=normalized, position=i))

    return tokens


# cross-industry synonym map: variant names/abbreviations -> canonical form,
# ported verbatim from synonyms.ts's SYNONYM_GROUPS
SYNONYM_GROUPS: list[list[str]] = [
    # === technology / programming ===
    ["javascript", "js", "ecmascript", "es6", "es2015"],
    ["typescript", "ts"],
    ["python", "py", "python3"],
    ["c++", "cpp", "c plus plus"],
    ["c#", "csharp", "c sharp"],
    ["golang", "go"],
    ["rust", "rustlang"],
    ["ruby", "rb"],
    ["kotlin", "kt"],
    ["swift", "swiftlang"],
    ["objective-c", "objc", "obj-c"],
    # frameworks / libraries
    ["react", "reactjs", "react.js"],
    ["angular", "angularjs", "angular.js"],
    ["vue", "vuejs", "vue.js"],
    ["svelte", "sveltejs", "sveltekit"],
    ["next.js", "nextjs", "next"],
    ["node.js", "nodejs", "node"],
    ["express", "expressjs", "express.js"],
    ["django", "django rest framework", "drf"],
    ["flask", "flask api"],
    ["spring", "spring boot", "spring framework"],
    [".net", "dotnet", ".net core", "asp.net"],
    ["ruby on rails", "rails", "ror"],
    ["laravel", "laravel php"],
    ["fastapi", "fast api"],
    # databases
    ["postgresql", "postgres", "psql"],
    ["mysql", "my sql"],
    ["mongodb", "mongo"],
    ["microsoft sql server", "mssql", "sql server", "tsql", "t-sql"],
    ["dynamodb", "dynamo db", "aws dynamodb"],
    ["elasticsearch", "elastic search", "es"],
    ["redis", "redis cache"],
    ["cassandra", "apache cassandra"],
    ["sqlite", "sqlite3"],
    # cloud / infrastructure
    ["amazon web services", "aws"],
    ["google cloud platform", "gcp", "google cloud"],
    ["microsoft azure", "azure"],
    ["docker", "containerization", "containers"],
    ["kubernetes", "k8s"],
    ["terraform", "infrastructure as code", "iac"],
    ["ci/cd", "cicd", "continuous integration", "continuous deployment"],
    ["github actions", "gh actions"],
    ["jenkins", "jenkins ci"],
    ["gitlab ci", "gitlab ci/cd"],
    ["cloudflare", "cf"],
    # data / ML
    ["machine learning", "ml"],
    ["artificial intelligence", "ai"],
    ["deep learning", "dl"],
    ["natural language processing", "nlp"],
    ["computer vision", "cv"],
    ["tensorflow", "tf"],
    ["pytorch", "torch"],
    ["pandas", "python pandas"],
    ["numpy", "np"],
    ["scikit-learn", "sklearn"],
    ["data science", "data analytics"],
    ["business intelligence", "bi"],
    ["extract transform load", "etl"],
    ["data warehouse", "dwh", "data warehousing"],
    # === finance / accounting ===
    ["financial modeling", "financial analysis"],
    ["generally accepted accounting principles", "gaap"],
    ["international financial reporting standards", "ifrs"],
    ["certified public accountant", "cpa"],
    ["chartered financial analyst", "cfa"],
    ["financial risk management", "frm"],
    ["accounts payable", "ap"],
    ["accounts receivable", "ar"],
    ["profit and loss", "p&l", "pnl"],
    ["return on investment", "roi"],
    ["key performance indicator", "kpi", "kpis"],
    ["enterprise resource planning", "erp"],
    ["sap", "sap erp", "sap s/4hana"],
    ["bloomberg terminal", "bloomberg"],
    ["discounted cash flow", "dcf"],
    ["mergers and acquisitions", "m&a"],
    ["initial public offering", "ipo"],
    ["private equity", "pe"],
    ["venture capital", "vc"],
    ["anti-money laundering", "aml"],
    ["know your customer", "kyc"],
    # === healthcare ===
    ["electronic health record", "ehr", "electronic medical record", "emr"],
    ["health insurance portability and accountability act", "hipaa"],
    ["international classification of diseases", "icd", "icd-10"],
    ["current procedural terminology", "cpt"],
    ["registered nurse", "rn"],
    ["licensed practical nurse", "lpn"],
    ["nurse practitioner", "np"],
    ["physician assistant", "pa"],
    ["basic life support", "bls"],
    ["advanced cardiovascular life support", "acls"],
    ["food and drug administration", "fda"],
    ["good manufacturing practice", "gmp"],
    ["clinical research organization", "cro"],
    # === marketing / sales ===
    ["search engine optimization", "seo"],
    ["search engine marketing", "sem"],
    ["pay per click", "ppc"],
    ["cost per acquisition", "cpa"],
    ["customer relationship management", "crm"],
    ["salesforce", "sfdc", "salesforce crm"],
    ["hubspot", "hubspot crm"],
    ["google analytics", "ga", "ga4"],
    ["social media marketing", "smm"],
    ["content management system", "cms"],
    ["email marketing", "email campaigns"],
    ["a/b testing", "ab testing", "split testing"],
    ["conversion rate optimization", "cro"],
    ["customer lifetime value", "clv", "ltv"],
    ["net promoter score", "nps"],
    ["marketing qualified lead", "mql"],
    ["sales qualified lead", "sql"],
    # === human resources ===
    ["human resources", "hr"],
    ["human capital management", "hcm"],
    ["applicant tracking system", "ats"],
    ["human resource information system", "hris"],
    ["employee resource planning", "erp"],
    ["diversity equity and inclusion", "dei", "de&i"],
    ["equal employment opportunity", "eeo"],
    ["professional in human resources", "phr"],
    ["senior professional in human resources", "sphr"],
    ["society for human resource management", "shrm"],
    # === project management ===
    ["project management", "pm"],
    ["project management professional", "pmp"],
    ["certified scrum master", "csm"],
    ["agile", "agile methodology"],
    ["scrum", "scrum framework"],
    ["kanban", "kanban board"],
    ["waterfall", "waterfall methodology"],
    ["jira", "atlassian jira"],
    ["asana", "asana pm"],
    ["trello", "trello board"],
    ["gantt chart", "gantt"],
    ["work breakdown structure", "wbs"],
    ["program management", "pgm"],
    # === legal ===
    ["juris doctor", "jd", "j.d."],
    ["intellectual property", "ip"],
    ["non-disclosure agreement", "nda"],
    ["service level agreement", "sla"],
    ["general data protection regulation", "gdpr"],
    ["california consumer privacy act", "ccpa"],
    ["digital millennium copyright act", "dmca"],
    ["terms of service", "tos"],
    # === supply chain / operations ===
    ["supply chain management", "scm"],
    ["enterprise resource planning", "erp"],
    ["manufacturing resource planning", "mrp"],
    ["total quality management", "tqm"],
    ["six sigma", "6 sigma", "6sigma"],
    ["lean manufacturing", "lean"],
    ["just in time", "jit"],
    ["inventory management", "inventory control"],
    ["vendor management", "supplier management"],
    ["request for proposal", "rfp"],
    ["request for quotation", "rfq"],
    # === general professional ===
    ["bachelor of science", "bs", "b.s."],
    ["bachelor of arts", "ba", "b.a."],
    ["master of science", "ms", "m.s."],
    ["master of arts", "ma", "m.a."],
    ["master of business administration", "mba", "m.b.a."],
    ["doctor of philosophy", "phd", "ph.d."],
    ["years of experience", "yoe", "years experience"],
    ["full time", "full-time", "ft"],
    ["part time", "part-time", "pt"],
    ["cross functional", "cross-functional"],
    ["stakeholder management", "stakeholder engagement"],
    ["problem solving", "problem-solving"],
    ["communication skills", "communication"],
    ["team leadership", "team lead", "team management"],
    ["microsoft office", "ms office", "office 365", "microsoft 365"],
    ["microsoft excel", "excel", "ms excel"],
    ["microsoft word", "word", "ms word"],
    ["microsoft powerpoint", "powerpoint", "ms powerpoint", "ppt"],
    ["tableau", "tableau desktop", "tableau server"],
    ["power bi", "powerbi", "microsoft power bi"],
]

# NOTE: "erp" maps to two different canonical phrases across three
# groups above (finance's/supply chain's "enterprise resource planning"
# vs. HR's "employee resource planning"), all three kept and in the
# original's group order — the map-building loop below overwrites on
# collision, so order matters: the last group wins ("enterprise resource
# planning", from supply chain). Dropping any of the three would silently
# change that outcome.

_SYNONYM_MAP: dict[str, str] = {}
for _group in SYNONYM_GROUPS:
    _canonical = _group[0]
    for _variant in _group:
        _SYNONYM_MAP[_variant.lower()] = _canonical


def get_canonical(term: str) -> str:
    """Returns the canonical form of a term, or the term itself if none exists."""
    return _SYNONYM_MAP.get(term.lower(), term.lower())


def are_synonyms(term1: str, term2: str) -> bool:
    return get_canonical(term1) == get_canonical(term2)
