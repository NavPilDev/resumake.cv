"""Rounds like JavaScript's Math.round, not Python's round().

Python's round() uses banker's rounding (round-half-to-even): round(0.5)
== 0, round(2.5) == 2. JS's Math.round() rounds half-up (toward
+Infinity): Math.round(0.5) === 1, Math.round(2.5) === 3. Every ported
scorer file's `Math.round(...)` call only ever rounds non-negative
values (percentages, 0-100 scores), where round-half-up is exactly
math.floor(x + 0.5) — used instead of round() throughout this package
so scores match the original TypeScript bit-for-bit on .5 boundaries.
"""

from __future__ import annotations

import math


def js_round(value: float) -> int:
    return math.floor(value + 0.5)
