"""Filesystem access to experience.yaml, exposed as a small FastAPI router so
resumake/client never touches the filesystem directly for it — mirrors the
/ollama split (see resumake-agent/__init__.py) but for plain file I/O
instead of LLM calls.

This only reads/writes raw text. YAML parsing, the
leading-comment-header preservation, and ExperienceData shape validation all
stay client-side (see resumake/client/lib/loadExperience.ts and
saveExperience.ts) — only the actual disk access moved server-side.

The canonical file lives under resumake/server/resumake-media/ (this
server's own local data directory, git-ignored — see .gitignore), not the
repo root. The repo-root experience.yaml is the older, pre-migration copy
resume-revisioner/ still uses — it's left in place but is no longer read or
written by resumake/client.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/experience", tags=["experience"])

# This file lives at resumake/server/experience_file/__init__.py, so
# resumake-media is a sibling of experience_file, one level up.
RESUMAKE_MEDIA_DIR = Path(__file__).resolve().parent.parent / "resumake-media"
EXPERIENCE_PATH = RESUMAKE_MEDIA_DIR / "experience.yaml"


class ExperienceFileContent(BaseModel):
    content: str


class SaveResult(BaseModel):
    path: str


@router.get("/raw")
def read_experience_file() -> ExperienceFileContent:
    """404s for a brand-new user with no experience.yaml yet — the client
    treats that as an empty-state, not an error."""
    if not EXPERIENCE_PATH.exists():
        raise HTTPException(
            status_code=404, detail=f"{EXPERIENCE_PATH} does not exist yet."
        )
    return ExperienceFileContent(content=EXPERIENCE_PATH.read_text(encoding="utf-8"))


@router.put("/raw")
def write_experience_file(body: ExperienceFileContent) -> SaveResult:
    RESUMAKE_MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    EXPERIENCE_PATH.write_text(body.content, encoding="utf-8")
    return SaveResult(path=str(EXPERIENCE_PATH))
