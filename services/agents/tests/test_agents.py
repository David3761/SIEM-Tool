"""
Unit tests for Agent 1 and Agent 2.
All external dependencies (psycopg2, ollama_client, redis) are mocked.
"""

import asyncio
import json
import sys
import types
import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch, call

import pytest

# ---------------------------------------------------------------------------
# Stub out psycopg2 before importing agents so the module-level import works
# even without a real Postgres installation.
# ---------------------------------------------------------------------------
psycopg2_stub = types.ModuleType("psycopg2")
psycopg2_extras_stub = types.ModuleType("psycopg2.extras")
psycopg2_extras_stub.RealDictCursor = object
psycopg2_stub.extras = psycopg2_extras_stub
psycopg2_stub.connect = MagicMock()
sys.modules.setdefault("psycopg2", psycopg2_stub)
sys.modules.setdefault("psycopg2.extras", psycopg2_extras_stub)

# Stub redis.asyncio
redis_stub = types.ModuleType("redis")
redis_asyncio_stub = types.ModuleType("redis.asyncio")
redis_asyncio_stub.from_url = MagicMock()          # ← patch target must exist
redis_stub.asyncio = redis_asyncio_stub
sys.modules.setdefault("redis", redis_stub)
sys.modules.setdefault("redis.asyncio", redis_asyncio_stub)

import agent1_threat_analyst as a1  # noqa: E402
import agent2_incident_response as a2  # noqa: E402


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_alert(
    alert_id="alert-1",
    rule_name="Port Scan Detection",
    severity="high",
    src_ip="192.168.1.100",
    triggering_event_id="evt-trigger",
    related_event_ids=None,
):
    return {
        "id": alert_id,
        "rule_id": "rule-1",
        "rule_name": rule_name,
        "severity": severity,
        "timestamp": datetime(2024, 1, 1, 10, 30, 0, tzinfo=timezone.utc),
        "status": "open",
        "triggering_event_id": triggering_event_id,
        "related_event_ids": related_event_ids or ["evt-1", "evt-2"],
        "ai_analysis": None,
        "incident_id": None,
    }


def _make_event(
    event_id="evt-1",
    src_ip="192.168.1.100",
    dst_ip="8.8.8.8",
    dst_port=21,
    protocol="TCP",
    flags="SYN",
    ts=None,
):
    return {
        "id": event_id,
        "timestamp": ts or datetime(2024, 1, 1, 10, 30, 1, tzinfo=timezone.utc),
        "src_ip": src_ip,
        "dst_ip": dst_ip,
        "src_port": 54321,
        "dst_port": dst_port,
        "protocol": protocol,
        "bytes_sent": 64,
        "direction": "outbound",
        "interface": "eth0",
        "flags": flags,
    }


def _make_incident(incident_id="inc-1", title="Port Scan Incident", severity="high"):
    return {
        "id": incident_id,
        "title": title,
        "severity": severity,
        "status": "open",
        "created_at": datetime(2024, 1, 1, 10, 29, 0, tzinfo=timezone.utc),
        "alert_ids": ["alert-1"],
        "ai_remediation": None,
        "timeline": None,
    }


# ---------------------------------------------------------------------------
# Agent 1 tests
# ---------------------------------------------------------------------------

class TestAgent1BuildsPrompt:
    """Agent 1 builds a prompt that contains the src_ip and rule_name."""

    @pytest.mark.asyncio
    async def test_prompt_contains_src_ip_and_rule_name(self):
        alert = _make_alert()
        trigger_event = _make_event()
        llm_response = {
            "threat_summary": "Port scan detected",
            "mitre_tactic": "Reconnaissance",
            "mitre_technique": "T1046 Network Service Discovery",
            "confidence": 0.85,
            "is_false_positive": False,
            "recommended_action": "Block IP",
            "risk_score": 7,
        }

        captured_prompts: list[str] = []

        async def fake_generate_json(prompt, model=None):
            captured_prompts.append(prompt)
            return llm_response

        with (
            patch.object(a1, "_fetch_alert", return_value=alert),
            patch.object(a1, "_fetch_related_events", return_value=[_make_event()]),
            patch.object(a1, "_fetch_triggering_event", return_value=trigger_event),
            patch.object(a1, "_fetch_recent_alerts_by_src_ip", return_value=[]),
            patch.object(a1, "_update_alert_analysis"),
            patch("agent1_threat_analyst.ollama_client.generate_json", side_effect=fake_generate_json),
        ):
            redis_mock = AsyncMock()
            redis_mock.publish = AsyncMock()
            pubsub_mock = AsyncMock()

            async def _listen():
                yield {"type": "message", "data": json.dumps({"id": "alert-1"})}

            pubsub_mock.listen = _listen
            pubsub_mock.subscribe = AsyncMock()
            redis_mock.pubsub = MagicMock(return_value=pubsub_mock)

            with patch("agent1_threat_analyst.aioredis.from_url", return_value=redis_mock):
                await a1.run()

        assert len(captured_prompts) == 1
        prompt = captured_prompts[0]
        assert "192.168.1.100" in prompt, "src_ip should appear in prompt"
        assert "Port Scan Detection" in prompt, "rule_name should appear in prompt"


class TestAgent1UpdatesAnalysis:
    """Agent 1 persists the LLM result in alert.ai_analysis."""

    @pytest.mark.asyncio
    async def test_updates_alert_ai_analysis(self):
        alert = _make_alert()
        trigger_event = _make_event()
        llm_response = {
            "threat_summary": "Brute force attempt",
            "mitre_tactic": "Credential Access",
            "mitre_technique": "T1110 Brute Force",
            "confidence": 0.9,
            "is_false_positive": False,
            "recommended_action": "Rate-limit SSH",
            "risk_score": 8,
        }

        stored: list[dict] = []

        def fake_update(alert_id, analysis):
            stored.append(analysis)

        with (
            patch.object(a1, "_fetch_alert", return_value=alert),
            patch.object(a1, "_fetch_related_events", return_value=[]),
            patch.object(a1, "_fetch_triggering_event", return_value=trigger_event),
            patch.object(a1, "_fetch_recent_alerts_by_src_ip", return_value=[]),
            patch.object(a1, "_update_alert_analysis", side_effect=fake_update),
            patch("agent1_threat_analyst.ollama_client.generate_json", return_value=llm_response),
        ):
            redis_mock = AsyncMock()
            redis_mock.publish = AsyncMock()
            pubsub_mock = AsyncMock()

            async def _listen():
                yield {"type": "message", "data": json.dumps({"id": "alert-1"})}

            pubsub_mock.listen = _listen
            pubsub_mock.subscribe = AsyncMock()
            redis_mock.pubsub = MagicMock(return_value=pubsub_mock)

            with patch("agent1_threat_analyst.aioredis.from_url", return_value=redis_mock):
                await a1.run()

        assert len(stored) == 1
        saved = stored[0]
        assert saved["threat_summary"] == "Brute force attempt"
        assert "analyzed_at" in saved


class TestAgent1HandlesOllamaException:
    """When Ollama raises an exception, Agent 1 stores an error dict."""

    @pytest.mark.asyncio
    async def test_stores_error_dict_on_ollama_failure(self):
        alert = _make_alert()
        trigger_event = _make_event()
        stored: list[dict] = []

        def fake_update(alert_id, analysis):
            stored.append(analysis)

        with (
            patch.object(a1, "_fetch_alert", return_value=alert),
            patch.object(a1, "_fetch_related_events", return_value=[]),
            patch.object(a1, "_fetch_triggering_event", return_value=trigger_event),
            patch.object(a1, "_fetch_recent_alerts_by_src_ip", return_value=[]),
            patch.object(a1, "_update_alert_analysis", side_effect=fake_update),
            patch(
                "agent1_threat_analyst.ollama_client.generate_json",
                side_effect=RuntimeError("Ollama connection refused"),
            ),
        ):
            redis_mock = AsyncMock()
            redis_mock.publish = AsyncMock()
            pubsub_mock = AsyncMock()

            async def _listen():
                yield {"type": "message", "data": json.dumps({"id": "alert-1"})}

            pubsub_mock.listen = _listen
            pubsub_mock.subscribe = AsyncMock()
            redis_mock.pubsub = MagicMock(return_value=pubsub_mock)

            with patch("agent1_threat_analyst.aioredis.from_url", return_value=redis_mock):
                await a1.run()

        assert len(stored) == 1
        err = stored[0]
        assert "error" in err
        assert "Ollama connection refused" in err["error"]
        assert "analyzed_at" in err


class TestAgent1HandlesErrorDict:
    """When generate_json returns an error dict, Agent 1 stores it without crashing."""

    @pytest.mark.asyncio
    async def test_handles_error_dict_gracefully(self):
        alert = _make_alert()
        trigger_event = _make_event()
        stored: list[dict] = []

        def fake_update(alert_id, analysis):
            stored.append(analysis)

        error_response = {"error": "parse failed", "analyzed_at": "2024-01-01T10:30:00+00:00"}

        with (
            patch.object(a1, "_fetch_alert", return_value=alert),
            patch.object(a1, "_fetch_related_events", return_value=[]),
            patch.object(a1, "_fetch_triggering_event", return_value=trigger_event),
            patch.object(a1, "_fetch_recent_alerts_by_src_ip", return_value=[]),
            patch.object(a1, "_update_alert_analysis", side_effect=fake_update),
            patch("agent1_threat_analyst.ollama_client.generate_json", return_value=error_response),
        ):
            redis_mock = AsyncMock()
            redis_mock.publish = AsyncMock()
            pubsub_mock = AsyncMock()

            async def _listen():
                yield {"type": "message", "data": json.dumps({"id": "alert-1"})}

            pubsub_mock.listen = _listen
            pubsub_mock.subscribe = AsyncMock()
            redis_mock.pubsub = MagicMock(return_value=pubsub_mock)

            with patch("agent1_threat_analyst.aioredis.from_url", return_value=redis_mock):
                await a1.run()

        assert len(stored) == 1
        assert stored[0]["error"] == "parse failed"


# ---------------------------------------------------------------------------
# Agent 2 tests
# ---------------------------------------------------------------------------

class TestAgent2SortsEventsChronologically:
    """Agent 2 sorts events by timestamp before building the timeline prompt."""

    @pytest.mark.asyncio
    async def test_events_sorted_chronologically(self):
        incident = _make_incident()

        alert = _make_alert(related_event_ids=["evt-b", "evt-a"])

        evt_a = _make_event(
            event_id="evt-a",
            ts=datetime(2024, 1, 1, 10, 30, 5, tzinfo=timezone.utc),
        )
        evt_b = _make_event(
            event_id="evt-b",
            ts=datetime(2024, 1, 1, 10, 29, 55, tzinfo=timezone.utc),
        )
        # evt_b is earlier, so after sorting the timeline should start with evt_b

        captured_prompts: list[str] = []

        async def fake_generate_json(prompt, model=None):
            captured_prompts.append(prompt)
            return {
                "executive_summary": "Port scan",
                "root_cause": "External attacker",
                "mitre_tactic": "Reconnaissance",
                "mitre_technique": "T1046",
                "confidence": 0.8,
                "remediation_steps": ["Block IP", "Review logs", "Patch firewall"],
                "containment_actions": ["Isolate host"],
                "affected_assets": ["192.168.1.100"],
                "timeline": [
                    {"time": "10:29:55Z", "event": "First packet"},
                    {"time": "10:30:05Z", "event": "Scan complete"},
                ],
                "estimated_impact": "medium",
                "requires_escalation": False,
            }

        stored_timelines: list = []

        def fake_update(incident_id, ai_remediation, timeline):
            stored_timelines.append(timeline)

        with (
            patch.object(a2, "_fetch_pending_incident", return_value=incident),
            patch.object(a2, "_fetch_alerts_by_ids", return_value=[alert]),
            patch.object(a2, "_fetch_events_by_ids", return_value=[evt_a, evt_b]),
            patch.object(a2, "_update_incident", side_effect=fake_update),
            patch("agent2_incident_response.ollama_client.generate_json", side_effect=fake_generate_json),
        ):
            # Run one iteration then stop the loop
            await a2._process_incident(incident)

        assert len(captured_prompts) == 1
        prompt = captured_prompts[0]

        # 10:29:55Z must appear before 10:30:05Z in the timeline text
        idx_early = prompt.find("10:29:55Z")
        idx_late = prompt.find("10:30:05Z")
        assert idx_early != -1, "Earlier timestamp missing from prompt"
        assert idx_late != -1, "Later timestamp missing from prompt"
        assert idx_early < idx_late, "Events are not in chronological order in prompt"
