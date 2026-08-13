"""All six ATS profiles, ordered by market share/strictness. Ported
from ats-screener's scorer/profiles/index.ts."""

from __future__ import annotations

from ..types import ATSProfile
from .workday import WORKDAY_PROFILE
from .taleo import TALEO_PROFILE
from .successfactors import SUCCESSFACTORS_PROFILE
from .icims import ICIMS_PROFILE
from .greenhouse import GREENHOUSE_PROFILE
from .lever import LEVER_PROFILE

ALL_PROFILES: list[ATSProfile] = [
    WORKDAY_PROFILE,
    TALEO_PROFILE,
    SUCCESSFACTORS_PROFILE,
    ICIMS_PROFILE,
    GREENHOUSE_PROFILE,
    LEVER_PROFILE,
]


def get_profile(name: str) -> ATSProfile | None:
    for profile in ALL_PROFILES:
        if profile.name.lower() == name.lower():
            return profile
    return None
