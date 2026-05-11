"""
Agent 1 – Threat Analyst
Subscribes to Redis "alerts:new", enriches each alert with AI analysis via Ollama,
then publishes the updated alert to "alerts:updated".
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras
import redis.asyncio as aioredis

import ollama_client

logger = logging.getLogger(__name__)

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
PG_DSN = os.environ.get(
    "POSTGRES_DSN",
    "host=localhost dbname=siem user=siem password=siem",
)

PROMPT_TEMPLATE = """You are a cybersecurity threat analyst. Analyze the following security alert and provide a structured JSON response.

Alert Details:
- Rule: {rule_name}
- Severity: {severity}
- Timestamp: {timestamp}
- Source IP: {src_ip}
- Destination: {dst_ip}:{dst_port}
- Protocol: {protocol}

Related Network Events (up to 10):
{related_events_text}

Recent Alerts from Same Source IP (last 5):
{recent_alerts_text}

Respond ONLY with a valid JSON object containing exactly these fields:
{{
  "threat_assessment": "<one-sentence assessment of the threat>",
  "severity_justification": "<why this severity level is appropriate>",
  "mitre_tactic": "<MITRE ATT&CK tactic name>",
  "mitre_technique": "<MITRE ATT&CK technique ID and name, e.g. T1046 Network Service Discovery>",
  "confidence": <float 0.0-1.0>,
  "is_false_positive_likely": <true|false>,
  "recommended_action": "<immediate action to take>",
  "risk_score": <integer 1-10>,
  "iocs": ["<suspicious IP, port, or pattern if relevant, or empty array>"]
}}"""

# Limit concurrent Ollama calls so the agent doesn't queue up
_SEMAPHORE = asyncio.Semaphore(2)

# Dedup: skip re-analysis of the same (rule_id, src_ip) within this window
_DEDUP_WINDOW_SECONDS = 120
_recently_analyzed: dict[str, float] = {}


def _get_pg_connection():
    return psycopg2.connect(PG_DSN, cursor_factory=psycopg2.extras.RealDictCursor)


def _fetch_alert(alert_id: str) -> dict | None:
    with _get_pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM alerts WHERE id = %s", (alert_id,))
            return cur.fetchone()


def _fetch_related_events(event_ids: list[str]) -> list[dict]:
    if not event_ids:
        return []
    with _get_pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM network_events WHERE id = ANY(%s::uuid[]) LIMIT 10",
                (event_ids,),
            )
            return cur.fetchall()


def _fetch_recent_alerts_by_src_ip(src_ip: str, current_alert_id: str) -> list[dict]:
    with _get_pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT a.*
                FROM alerts a
                JOIN network_events e ON e.id = a.triggering_event_id
                WHERE e.src_ip = %s AND a.id != %s
                ORDER BY a.timestamp DESC
                LIMIT 5
                """,
                (src_ip, current_alert_id),
            )
            return cur.fetchall()


def _update_alert_analysis(alert_id: str, ai_analysis: dict) -> None:
    is_fp = ai_analysis.get("is_false_positive_likely", False)
    new_status = "false_positive" if is_fp else "acknowledged"
    with _get_pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE alerts SET ai_analysis = %s, status = %s WHERE id = %s",
                (json.dumps(ai_analysis), new_status, alert_id),
            )
        conn.commit()


def _fetch_triggering_event(event_id: str) -> dict | None:
    if not event_id:
        return None
    with _get_pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM network_events WHERE id = %s",
                (event_id,),
            )
            return cur.fetchone()


def _format_event_line(ev: dict) -> str:
    ts = ev.get("timestamp", "")
    if hasattr(ts, "strftime"):
        ts = ts.strftime("%H:%M:%SZ")
    flags = ev.get("flags", "")
    flag_str = f" {flags}" if flags else ""
    return (
        f"{ts}: {ev.get('src_ip', '?')} -> "
        f"{ev.get('dst_ip', '?')}:{ev.get('dst_port', '?')} "
        f"({ev.get('protocol', '?')}{flag_str})"
    )


def _format_alert_line(al: dict) -> str:
    ts = al.get("timestamp", "")
    if hasattr(ts, "strftime"):
        ts = ts.strftime("%H:%M:%SZ")
    return f"{ts}: {al.get('rule_name', '?')} ({al.get('severity', '?')})"


async def _handle_message(payload: dict, redis_client) -> None:
    """Process a single alert message. Extracted so tests can call it directly."""
    alert_id = payload.get("id") or payload.get("alert_id")
    if not alert_id:
        logger.warning("Message missing alert id: %s", payload)
        return

    alert = _fetch_alert(alert_id)
    if not alert:
        logger.warning("Alert %s not found in DB", alert_id)
        return

    alert = dict(alert)

    related_ids = alert.get("related_event_ids") or []
    if isinstance(related_ids, str):
        related_ids = json.loads(related_ids)
    related_events = _fetch_related_events(related_ids)

    triggering = _fetch_triggering_event(alert.get("triggering_event_id"))
    src_ip = triggering.get("src_ip", "unknown") if triggering else "unknown"
    dst_ip = triggering.get("dst_ip", "unknown") if triggering else "unknown"
    dst_port = triggering.get("dst_port", "?") if triggering else "?"
    protocol = triggering.get("protocol", "?") if triggering else "?"

    # Skip if we analyzed this exact (rule, source) combination very recently
    dedup_key = f"{alert.get('rule_id')}:{src_ip}"
    now = asyncio.get_event_loop().time()
    last = _recently_analyzed.get(dedup_key, 0)
    if now - last < _DEDUP_WINDOW_SECONDS:
        logger.info("Skipping duplicate analysis for %s (cooldown)", dedup_key)
        return
    _recently_analyzed[dedup_key] = now

    recent_alerts = _fetch_recent_alerts_by_src_ip(src_ip, alert_id)

    related_events_text = (
        "\n".join(_format_event_line(dict(e)) for e in related_events)
        or "No related events."
    )
    recent_alerts_text = (
        "\n".join(_format_alert_line(dict(a)) for a in recent_alerts)
        or "No recent alerts from this source."
    )

    ts = alert.get("timestamp", "")
    if hasattr(ts, "isoformat"):
        ts = ts.isoformat()

    prompt = PROMPT_TEMPLATE.format(
        rule_name=alert.get("rule_name", ""),
        severity=alert.get("severity", ""),
        timestamp=ts,
        src_ip=src_ip,
        dst_ip=dst_ip,
        dst_port=dst_port,
        protocol=protocol,
        related_events_text=related_events_text,
        recent_alerts_text=recent_alerts_text,
    )

    try:
        analysis = await ollama_client.generate_json(prompt)
    except Exception as exc:
        logger.error("Ollama error for alert %s: %s", alert_id, exc)
        analysis = {
            "error": str(exc),
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
        }

    analysis["analyzed_at"] = datetime.now(timezone.utc).isoformat()

    _update_alert_analysis(alert_id, analysis)

    is_fp = analysis.get("is_false_positive_likely", False)
    alert["status"] = "false_positive" if is_fp else "acknowledged"
    alert["ai_analysis"] = analysis
    publish_payload = {
        k: (v.isoformat() if hasattr(v, "isoformat") else
            str(v) if not isinstance(v, (str, int, float, bool, list, dict, type(None))) else v)
        for k, v in alert.items()
    }
    await redis_client.publish("alerts:updated", json.dumps(publish_payload))
    logger.info("Alert %s analysed and published.", alert_id)


async def _handle_with_semaphore(payload: dict, redis_client) -> None:
    async with _SEMAPHORE:
        try:
            await _handle_message(payload, redis_client)
        except Exception as exc:
            logger.exception("Unhandled error processing message: %s", exc)


async def run() -> None:
    while True:
        try:
            redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
            pubsub = redis_client.pubsub()
            await pubsub.subscribe("alerts:new")
            logger.info("Agent 1 subscribed to alerts:new")

            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    payload = json.loads(message["data"])
                    asyncio.create_task(_handle_with_semaphore(payload, redis_client))
                except Exception as exc:
                    logger.exception("Unhandled error processing message: %s", exc)

        except Exception as exc:
            logger.error("Agent 1 Redis connection lost: %s — reconnecting in 5s", exc)
            await asyncio.sleep(5)