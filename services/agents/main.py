import asyncio
import logging
import os

import ollama_client
import agent1_threat_analyst
import agent2_incident_response

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s – %(message)s",
)

logger = logging.getLogger(__name__)

MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")


async def run_with_restart(name: str, coro_fn, restart_delay: float = 5.0) -> None:
    while True:
        try:
            logger.info("Starting %s", name)
            await coro_fn()
        except Exception as exc:
            logger.error("%s crashed: %s — restarting in %.0fs", name, exc, restart_delay)
            await asyncio.sleep(restart_delay)


async def main() -> None:
    await ollama_client.ensure_model_available(MODEL)
    await asyncio.gather(
        run_with_restart("Agent1-ThreatAnalyst", agent1_threat_analyst.run),
        run_with_restart("Agent2-IncidentResponse", agent2_incident_response.run),
    )


if __name__ == "__main__":
    asyncio.run(main())