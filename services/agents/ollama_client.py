import json
import logging
from datetime import datetime, timezone

import httpx

OLLAMA_URL = __import__("os").environ.get("OLLAMA_URL", "http://localhost:11434")

logger = logging.getLogger(__name__)


async def generate(prompt: str, model: str = "llama3.2:3b") -> str:
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {"temperature": 0.3},
            },
        )
        response.raise_for_status()
        return response.json()["response"]


async def generate_json(prompt: str, model: str = "llama3.2:3b") -> dict:
    for attempt in range(2):
        try:
            raw = await generate(prompt, model)
            # Strip markdown code fences if present
            text = raw.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            return json.loads(text.strip())
        except (json.JSONDecodeError, ValueError) as e:
            if attempt == 1:
                logger.error("JSON parse failed after retry: %s", e)
                return {
                    "error": "parse failed",
                    "analyzed_at": datetime.now(timezone.utc).isoformat(),
                }
            logger.warning("JSON parse failed on attempt 1, retrying: %s", e)


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
