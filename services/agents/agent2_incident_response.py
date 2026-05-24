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

Alerts:
{alerts_summary}

Event sample (chronological, most recent {event_count} events):
{timeline_text}

Respond ONLY with a valid JSON object containing exactly these fields:
{{
  "summary": "<2-3 sentence executive summary of the incident>",
  "attack_pattern": "<short attack pattern, e.g. Reconnaissance → Initial Access → Lateral Movement>",
  "mitre_tactics": ["<MITRE ATT&CK tactic>"],
  "mitre_techniques": ["<T1046 Network Service Discovery>"],
  "remediation_steps": [
    "IMMEDIATE: <urgent containment action>",
    "SHORT-TERM: <action within hours>",
    "LONG-TERM: <hardening measure>"
  ],
  "iocs": ["<suspicious IP, domain, or pattern>"]
}}"""

# Cap events fed to the LLM — beyond this the prompt grows too large for fast inference
MAX_EVENTS_IN_PROMPT = 20


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
    logger.info("Agent 2 started – polling every 5 s")
    while True:
        try:
            incident = _fetch_pending_incident()
            if incident:
                await _process_incident(incident)
        except Exception as exc:
            logger.exception("Agent 2 unhandled error: %s", exc)
        await asyncio.sleep(5)


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

    # Sort chronologically (oldest → newest)
    def _event_sort_key(ev: dict):
        ts = ev.get("timestamp")
        if ts is None:
            return ""
        if hasattr(ts, "isoformat"):
            return ts.isoformat()
        return str(ts)

    events.sort(key=_event_sort_key)

    # Cap the sample fed to the LLM — keep most recent N
    sample_events = events[-MAX_EVENTS_IN_PROMPT:]

    timeline_text = (
        "\n".join(_format_timeline_line(e) for e in sample_events) or "No events available."
    )

    alerts_summary = "\n".join(
        f"- {al.get('rule_name', '?')} ({al.get('severity', '?')})" for al in alerts
    ) or "No alerts."

    prompt = PROMPT_TEMPLATE.format(
        title=incident.get("title", ""),
        severity=incident.get("severity", ""),
        event_count=len(sample_events),
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

    # Build timeline locally from sorted events — no need to ask the LLM
    local_timeline = [
        {
            "timestamp": (ev["timestamp"].isoformat() if hasattr(ev.get("timestamp"), "isoformat") else str(ev.get("timestamp", ""))),
            "event": _format_timeline_line(ev),
            "significance": "medium",
        }
        for ev in events
    ]

    _update_incident(incident_id, result, local_timeline)
    logger.info("Incident %s remediation stored.", incident_id)
