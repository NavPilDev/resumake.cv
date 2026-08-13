"""Deterministic ATS-scoring engine.

Ported from sunnypatell/ats-screener's src/lib/engine/scorer/ (MIT
licensed — see /resumake/NOTICE). Unlike analyze.py's LLM-based bullet
scoring, this simulates how six real ATS platforms parse and weight a
resume: same input always produces the same output, no model call
involved. The router wiring lives here once the engine (subtask 6) is
in place.
"""

from __future__ import annotations
