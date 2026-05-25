import json
import logging
from datetime import datetime, timezone

import httpx

OLLAMA_URL = __import__("os").environ.get("OLLAMA_URL", "http://localhost:11434")

logger = logging.getLogger(__name__)


async def generate(prompt: str, model: str = "llama3.2:3b", json_mode: bool = False) -> str:
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {"temperature": 0.3},
    }
    # Ollama supports forcing JSON output via the "format" parameter
    if json_mode:
        payload["format"] = "json"
    async with httpx.AsyncClient(timeout=45.0) as client:
        response = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
        response.raise_for_status()
        return response.json()["response"]


def _extract_json(raw: str) -> dict:
    """Best-effort JSON extraction from LLM output.
    Handles plain JSON, markdown code fences, and text-before-JSON prose."""
    text = raw.strip()

    # Strip markdown code fences (```json ... ``` or just ``` ... ```)
    if text.startswith("```"):
        text = text.split("```", 2)[1] if "```" in text[3:] else text[3:]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    # Direct parse — fast path
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fallback: find the first {...} block and try to parse it
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end > start:
        candidate = text[start:end + 1]
        return json.loads(candidate)

    raise json.JSONDecodeError("No JSON object found in output", text, 0)


async def generate_json(prompt: str, model: str = "llama3.2:3b") -> dict:
    last_error: str | None = None
    for attempt in range(2):
        try:
            # Use Ollama's JSON mode to force structured output
            raw = await generate(prompt, model, json_mode=True)
            return _extract_json(raw)
        except (json.JSONDecodeError, ValueError) as e:
            last_error = str(e)
            if attempt == 0:
                logger.warning("JSON parse failed on attempt 1, retrying: %s", e)
            else:
                logger.error("JSON parse failed after retry: %s", e)

    return {
        "error": f"AI model returned unparseable output ({last_error}). Try regenerating.",
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
    }


async def ensure_model_available(model: str = "llama3.2:3b") -> None:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(f"{OLLAMA_URL}/api/tags")
        resp.raise_for_status()
        models = [m["name"] for m in resp.json().get("models", [])]
        if model not in models:
            logger.info("Pulling model %s …", model)
            pull = await client.post(
                f"{OLLAMA_URL}/api/pull",
                json={"name": model},
                timeout=600.0,
            )
            pull.raise_for_status()
            logger.info("Model %s ready.", model)
        else:
            logger.info("Model %s already available.", model)
