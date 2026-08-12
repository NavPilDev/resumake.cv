"""Single-bullet rewrite against a job description, for POST /ollama/improve."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from .models import ImproveRequest
from .ollama_client import normalize_host, ollama_json_chat

router = APIRouter()


async def improve_with_ollama(req: ImproveRequest) -> str:
    host = normalize_host(req.host)
    prompt = f"""JOB DESCRIPTION:
\"\"\"
{req.jdText.strip()}
\"\"\"

ORIGINAL RESUME BULLET:
"{req.bulletText}"
Tags: {", ".join(req.tags) or "none"}

TASK: Rewrite the bullet to better align with the job description above. Keep it ONE sentence, in resume-bullet style (past tense, action-verb led). Do NOT invent skills, tools, technologies, or metrics that aren't implied by the original bullet — only rephrase, reorder, and emphasize what's already true. If the original has no reasonable connection to the job description, make only light wording improvements rather than forcing an unrelated connection.

Respond with ONLY one JSON object, no markdown fences, no commentary: {{ "improvedText": "<rewritten bullet>" }}"""

    parsed = await ollama_json_chat(host, req.model, prompt)
    improved = parsed.get("improvedText") if isinstance(parsed, dict) else None
    improved = improved.strip() if isinstance(improved, str) else ""
    if not improved:
        raise RuntimeError("Ollama did not return an improved bullet — try again.")
    return improved


@router.post("/improve")
async def improve_endpoint(req: ImproveRequest) -> dict:
    try:
        improved_text = await improve_with_ollama(req)
    except Exception as err:
        raise HTTPException(status_code=502, detail=str(err)) from err
    return {"improvedText": improved_text}
