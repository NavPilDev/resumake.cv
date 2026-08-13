"""All local-LLM (Ollama) functionality for Resumake, exposed as FastAPI
endpoints under /ollama.

Split by feature: analyze.py (section scoring + gaps + overview), improve.py
(single-bullet rewrite), extract.py (experience extraction), with models.py,
ollama_client.py, and keywords.py holding what's shared across them.
"""

from __future__ import annotations

from fastapi import APIRouter

from . import analyze, ats_scoring, extract, improve

router = APIRouter(prefix="/ollama", tags=["ollama"])
router.include_router(analyze.router)
router.include_router(improve.router)
router.include_router(extract.router)
router.include_router(ats_scoring.router)
