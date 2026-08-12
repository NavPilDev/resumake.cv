"""Low-level Ollama chat helpers shared by every /ollama endpoint."""

from __future__ import annotations

import json
from typing import Any

import httpx
import ollama

DEFAULT_HOST = "http://localhost:11434"
REQUEST_TIMEOUT_S = 120
SYSTEM_PROMPT = (
    "You are a precise resume-tailoring assistant. Respond with strictly "
    "valid JSON only — no markdown fences, no commentary, no trailing commas."
)


def normalize_host(host: str | None) -> str:
    return (host or DEFAULT_HOST).rstrip("/")


async def call_ollama_chat(host: str, model: str, prompt: str) -> str:
    client = ollama.AsyncClient(host=host, timeout=REQUEST_TIMEOUT_S)
    try:
        response = await client.chat(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            format="json",
            stream=False,
            options={"temperature": 0.2},
        )
    except ollama.ResponseError as err:
        raise RuntimeError(
            f"Ollama request failed ({err.status_code}). "
            f"{err.error or 'Check that the model name is correct and pulled (`ollama list`).'}"
        ) from err
    except httpx.TimeoutException as err:
        raise RuntimeError(
            f"Ollama at {host} didn't respond within {REQUEST_TIMEOUT_S}s. The model may be "
            "too large for this machine, or still loading — try again."
        ) from err
    except (ConnectionError, httpx.HTTPError) as err:
        # The ollama client wraps httpx.ConnectError into a plain
        # ConnectionError itself; httpx.HTTPError catches anything else
        # transport-level that isn't a timeout.
        raise RuntimeError(f"Could not reach Ollama at {host}. Is `ollama serve` running? ({err})") from err

    content = response.message.content if response.message else None
    if not content or not content.strip():
        raise RuntimeError("Ollama returned an empty response.")
    return content


def parse_model_json(raw: str) -> Any:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start = raw.find("{")
        end = raw.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(raw[start : end + 1])
            except json.JSONDecodeError:
                pass
        raise RuntimeError("Ollama returned invalid JSON — try again or use a different model.")


async def ollama_json_chat(host: str, model: str, prompt: str) -> Any:
    raw = await call_ollama_chat(host, model, prompt)
    return parse_model_json(raw)
