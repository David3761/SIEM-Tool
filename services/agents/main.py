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

MODEL = os.environ.get("OLLAMA_MODEL", "llama3.2:3b")


async def main() -> None:
    await ollama_client.ensure_model_available(MODEL)
    await asyncio.gather(
        agent1_threat_analyst.run(),
        agent2_incident_response.run(),
    )


if __name__ == "__main__":
    asyncio.run(main())
