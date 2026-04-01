"""
Agent 2 – Incident Response
Polls PostgreSQL every 10 seconds for incidents without AI remediation,
generates a remediation plan via Ollama, and persists the result.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras

import ollama_client

logger = logging.getLogger(__name__)

PG_DSN = os.environ.get(
    "POSTGRES_DSN",
    "host=localhost dbname=siem user=siem password=siem",
)

PROMPT_TEMPLATE = """You are a cybersecurity incident response expert. Analyse the following security incident and provide a structured JSON remediation plan.

Incident Details:
- Title: {title}
- Severity: {severity}
- Status: {status}
- Created At: {created_at}

Alerts Summary:
{alerts_summary}

Event Timeline (chronological):
{timeline_text}

Respond ONLY with a valid JSON object containing exactly these fields:
{{
  "executive_summary": "<2-3 sentence summary of the incident>",
  "root_cause": "<identified or suspected root cause>",
  "mitre_tactic": "<primary MITRE ATT&CK tactic>",
  "mitre_technique": "<primary MITRE ATT&CK technique ID and name>",
  "confidence": <float 0.0-1.0>,
  "remediation_steps": [
    "<step 1>",
    "<step 2>",
    "<step 3>"
  ],
  "containment_actions": ["<action 1>", "<action 2>"],
  "affected_assets": ["<asset 1>"],
  "timeline": [
    {{"time": "<HH:MM:SSZ>", "event": "<description>"}},
    ...
  ],
  "estimated_impact": "<low|medium|high|critical>",
  "requires_escalation": <true|false>
}}"""


def _get_pg_connection():
    return psycopg2.connect(PG_DSN, cursor_factory=psycopg2.extras.RealDictCursor)


def _fetch_pending_incident() -> dict | None:
    with _get_pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT * FROM incidents
                WHERE ai_remediation IS NULL
                ORDER BY created_at DESC
                LIMIT 1
                """
            )
            row = cur.fetchone()
            return dict(row) if row else None


def _fetch_alerts_by_ids(alert_ids: list[str]) -> list[dict]:
    if not alert_ids:
        return []
    with _get_pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM alerts WHERE id = ANY(%s::uuid[])",
                (alert_ids,),
            )
            return [dict(r) for r in cur.fetchall()]


def _fetch_events_by_ids(event_ids: list[str]) -> list[dict]:
    if not event_ids:
        return []
    with _get_pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM network_events WHERE id = ANY(%s::uuid[])",
                (event_ids,),
            )
            return [dict(r) for r in cur.fetchall()]


def _update_incident(incident_id: str, ai_remediation: dict, timeline: list) -> None:
    with _get_pg_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE incidents
                SET ai_remediation = %s, timeline = %s
                WHERE id = %s
                """,
                (
                    json.dumps(ai_remediation),
                    json.dumps(timeline),
                    incident_id,
                ),
            )
        conn.commit()


def _format_timeline_line(ev: dict) -> str:
    ts = ev.get("timestamp", "")
    if hasattr(ts, "strftime"):
        ts = ts.strftime("%H:%M:%SZ")
    flags = ev.get("flags", "")
    flag_str = f" {flags}" if flags else ""
    return (
        f"{ts}: {ev.get('protocol', '?')}{flag_str} "
        f"{ev.get('src_ip', '?')}->{ev.get('dst_ip', '?')}:{ev.get('dst_port', '?')}"
    )


async def run() -> None:
    logger.info("Agent 2 started – polling every 10 s")
    while True:
        try:
            incident = _fetch_pending_incident()
            if incident:
                await _process_incident(incident)
        except Exception as exc:
            logger.exception("Agent 2 unhandled error: %s", exc)
        await asyncio.sleep(10)


async def _process_incident(incident: dict) -> None:
    incident_id = str(incident["id"])
    logger.info("Processing incident %s", incident_id)

    # Collect alert_ids
    alert_ids = incident.get("alert_ids") or []
    if isinstance(alert_ids, str):
        alert_ids = json.loads(alert_ids)
    alert_ids = [str(a) for a in alert_ids]

    alerts = _fetch_alerts_by_ids(alert_ids)

    # Collect all event ids referenced across alerts
    all_event_ids: list[str] = []
    for al in alerts:
        rel = al.get("related_event_ids") or []
        if isinstance(rel, str):
            rel = json.loads(rel)
        all_event_ids.extend(str(e) for e in rel)
        if al.get("triggering_event_id"):
            all_event_ids.append(str(al["triggering_event_id"]))

    # Deduplicate
    all_event_ids = list(dict.fromkeys(all_event_ids))

    events = _fetch_events_by_ids(all_event_ids)

    # Sort chronologically
    def _event_sort_key(ev: dict):
        ts = ev.get("timestamp")
        if ts is None:
            return ""
        if hasattr(ts, "isoformat"):
            return ts.isoformat()
        return str(ts)

    events.sort(key=_event_sort_key)

    timeline_text = (
        "\n".join(_format_timeline_line(e) for e in events) or "No events available."
    )

    alerts_summary = ", ".join(
        f"{al.get('rule_name', '?')} ({al.get('severity', '?')})" for al in alerts
    ) or "No alerts."

    created_at = incident.get("created_at", "")
    if hasattr(created_at, "isoformat"):
        created_at = created_at.isoformat()

    prompt = PROMPT_TEMPLATE.format(
        title=incident.get("title", ""),
        severity=incident.get("severity", ""),
        status=incident.get("status", ""),
        created_at=created_at,
        alerts_summary=alerts_summary,
        timeline_text=timeline_text,
    )

    try:
        result = await ollama_client.generate_json(prompt)
    except Exception as exc:
        logger.error("Ollama error for incident %s: %s", incident_id, exc)
        result = {
            "error": str(exc),
            "analyzed_at": datetime.now(timezone.utc).isoformat(),
        }

    result["analyzed_at"] = datetime.now(timezone.utc).isoformat()

    # Extract timeline array from LLM result for the incidents.timeline column
    llm_timeline = result.get("timeline", [])

    _update_incident(incident_id, result, llm_timeline)
    logger.info("Incident %s remediation stored.", incident_id)
