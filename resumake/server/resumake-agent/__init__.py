"""All local-LLM (Ollama) functionality for Resumake, exposed as FastAPI
endpoints under /ollama.

Ported from the former resumake/client/lib/ollama.ts and
lib/experienceExtraction.ts so the Next.js app never talks to Ollama
directly — it now relays through this server instead. Prompts are kept
word-for-word identical to the original TypeScript so scoring/gap/overview
behavior doesn't drift.

Split by feature: analyze.py (section scoring + gaps + overview), improve.py
(single-bullet rewrite), extract.py (experience extraction), with models.py,
ollama_client.py, and keywords.py holding what's shared across them.
"""

from __future__ import annotations

from fastapi import APIRouter

from . import analyze, extract, improve

router = APIRouter(prefix="/ollama", tags=["ollama"])
router.include_router(analyze.router)
router.include_router(improve.router)
router.include_router(extract.router)
