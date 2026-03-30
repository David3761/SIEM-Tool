"""
Eval tests for Agent 1 and Agent 2.
These tests validate the *shape and quality* of LLM responses by mocking
generate_json with realistic controllable outputs and asserting structural
invariants that the production system depends on.
"""

import json
import sys
import types
import unittest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Stub psycopg2 + redis before importing agents (same pattern as test_agents)
# ---------------------------------------------------------------------------
for mod_name, mod in [
    ("psycopg2", types.ModuleType("psycopg2")),
    ("psycopg2.extras", types.ModuleType("psycopg2.extras")),
    ("redis", types.ModuleType("redis")),
    ("redis.asyncio", types.ModuleType("redis.asyncio")),
]:
    if mod_name not in sys.modules:
        sys.modules[mod_name] = mod

# patch target must exist on the stub before agent1 is imported
sys.modules["redis.asyncio"].from_url = MagicMock()  # type: ignore[attr-defined]
sys.modules["redis"].asyncio = sys.modules["redis.asyncio"]  # type: ignore[attr-defined]

psycopg2_stub = sys.modules["psycopg2"]
psycopg2_extras_stub = sys.modules["psycopg2.extras"]
psycopg2_extras_stub.RealDictCursor = object  # type: ignore[attr-defined]
psycopg2_stub.extras = psycopg2_extras_stub  # type: ignore[attr-defined]
psycopg2_stub.connect = MagicMock()  # type: ignore[attr-defined]

import agent1_threat_analyst as a1  # noqa: E402
import agent2_incident_response as a2  # noqa: E402

# ---------------------------------------------------------------------------
# Shared realistic response factories
# ---------------------------------------------------------------------------

AGENT1_REQUIRED_FIELDS = {
    "threat_summary",
    "mitre_tactic",
    "mitre_technique",
    "confidence",
    "is_false_positive",
    "recommended_action",
    "risk_score",
}

AGENT2_REQUIRED_FIELDS = {
    "executive_summary",
    "root_cause",
    "mitre_tactic",
    "mitre_technique",
    "confidence",
    "remediation_steps",
    "containment_actions",
    "affected_assets",
    "timeline",
    "estimated_impact",
    "requires_escalation",
}


def _port_scan_analysis():
    return {
        "threat_summary": "External host performed a TCP SYN scan across 254 hosts.",
        "mitre_tactic": "Reconnaissance",
        "mitre_technique": "T1046 Network Service Discovery",
        "confidence": 0.92,
        "is_false_positive": False,
        "recommended_action": "Block source IP at perimeter firewall and review IDS rules.",
        "risk_score": 7,
    }


def _ssh_brute_force_analysis():
    return {
        "threat_summary": "Repeated failed SSH login attempts from a single IP.",
        "mitre_tactic": "Credential Access",
        "mitre_technique": "T1110.001 Password Guessing",
        "confidence": 0.88,
        "is_false_positive": False,
        "recommended_action": "Rate-limit SSH connections and enable fail2ban.",
        "risk_score": 8,
    }


def _incident_remediation(timeline=None):
    return {
        "executive_summary": (
            "An external attacker conducted reconnaissance via port scanning "
            "followed by SSH brute-force attempts against internal hosts. "
            "Credentials may have been compromised."
        ),
        "root_cause": "Inadequate perimeter controls and exposed SSH service.",
        "mitre_tactic": "Reconnaissance",
        "mitre_technique": "T1046 Network Service Discovery",
        "confidence": 0.85,
        "remediation_steps": [
            "Block the attacker IP at the perimeter firewall immediately.",
            "Rotate SSH credentials for all affected accounts.",
            "Harden SSH configuration (disable password auth, use key pairs).",
            "Review and tighten network ACLs for management interfaces.",
        ],
        "containment_actions": [
            "Isolate affected host from internal network.",
            "Capture memory image for forensic analysis.",
        ],
        "affected_assets": ["192.168.1.100", "ssh-server-01"],
        "timeline": timeline
        or [
            {"time": "10:29:55Z", "event": "Initial SYN packets observed from attacker IP"},
            {"time": "10:30:01Z", "event": "Port scan sweep completed across /24 subnet"},
            {"time": "10:30:45Z", "event": "SSH brute-force attack commenced"},
            {"time": "10:31:10Z", "event": "Multiple failed login attempts recorded"},
        ],
        "estimated_impact": "high",
        "requires_escalation": True,
    }


# ---------------------------------------------------------------------------
# Helper: run one Agent 1 pass
# ---------------------------------------------------------------------------

def _make_a1_alert(rule_name="Port Scan Detection", severity="high", src_ip="192.168.1.100"):
    return {
        "id": "alert-eval-1",
        "rule_id": "rule-1",
        "rule_name": rule_name,
        "severity": severity,
        "timestamp": datetime(2024, 1, 1, 10, 30, 0, tzinfo=timezone.utc),
        "status": "open",
        "triggering_event_id": "evt-trigger",
        "related_event_ids": ["evt-1"],
        "ai_analysis": None,
        "incident_id": None,
    }


def _make_trigger_event(src_ip="192.168.1.100"):
    return {
        "id": "evt-trigger",
        "timestamp": datetime(2024, 1, 1, 10, 30, 1, tzinfo=timezone.utc),
        "src_ip": src_ip,
        "dst_ip": "10.0.0.1",
        "src_port": 54321,
        "dst_port": 22,
        "protocol": "TCP",
        "bytes_sent": 64,
        "direction": "outbound",
        "interface": "eth0",
        "flags": "SYN",
    }


async def _run_agent1_once(llm_response: dict) -> dict:
    """Drive Agent 1 through one full cycle and return the stored analysis."""
    stored: list[dict] = []

    def fake_update(alert_id, analysis):
        stored.append(analysis)

    with (
        patch.object(a1, "_fetch_alert", return_value=_make_a1_alert()),
        patch.object(a1, "_fetch_related_events", return_value=[]),
        patch.object(a1, "_fetch_triggering_event", return_value=_make_trigger_event()),
        patch.object(a1, "_fetch_recent_alerts_by_src_ip", return_value=[]),
        patch.object(a1, "_update_alert_analysis", side_effect=fake_update),
        patch("agent1_threat_analyst.ollama_client.generate_json", return_value=llm_response),
    ):
        redis_mock = AsyncMock()
        redis_mock.publish = AsyncMock()
        pubsub_mock = AsyncMock()

        import json as _json

        async def _listen():
            yield {"type": "message", "data": _json.dumps({"id": "alert-eval-1"})}

        pubsub_mock.listen = _listen
        pubsub_mock.subscribe = AsyncMock()
        redis_mock.pubsub = MagicMock(return_value=pubsub_mock)

        with patch("agent1_threat_analyst.aioredis.from_url", return_value=redis_mock):
            await a1.run()

    assert stored, "Agent 1 did not store any analysis"
    return stored[0]


# ---------------------------------------------------------------------------
# Eval: Port scan → mitre_tactic == "Reconnaissance"
# ---------------------------------------------------------------------------

class TestEvalPortScanMitreTactic:
    @pytest.mark.asyncio
    async def test_port_scan_mitre_tactic_is_reconnaissance(self):
        llm_response = _port_scan_analysis()
        result = await _run_agent1_once(llm_response)
        assert result.get("mitre_tactic") == "Reconnaissance", (
            f"Expected mitre_tactic='Reconnaissance', got {result.get('mitre_tactic')!r}"
        )


# ---------------------------------------------------------------------------
# Eval: confidence must always be float in [0.0, 1.0]
# ---------------------------------------------------------------------------

class TestEvalConfidenceRange:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "llm_response",
        [_port_scan_analysis(), _ssh_brute_force_analysis()],
    )
    async def test_confidence_is_float_between_0_and_1(self, llm_response):
        result = await _run_agent1_once(llm_response)
        confidence = result.get("confidence")
        assert isinstance(confidence, (int, float)), (
            f"confidence should be numeric, got {type(confidence)}"
        )
        assert 0.0 <= float(confidence) <= 1.0, (
            f"confidence out of range: {confidence}"
        )


# ---------------------------------------------------------------------------
# Eval: all required fields present in every Agent 1 response
# ---------------------------------------------------------------------------

class TestEvalAgent1RequiredFields:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "llm_response",
        [_port_scan_analysis(), _ssh_brute_force_analysis()],
    )
    async def test_all_required_fields_present(self, llm_response):
        result = await _run_agent1_once(llm_response)
        missing = AGENT1_REQUIRED_FIELDS - set(result.keys())
        assert not missing, f"Missing required fields: {missing}"


# ---------------------------------------------------------------------------
# Eval: remediation_steps must have >= 3 items (Agent 2)
# ---------------------------------------------------------------------------

class TestEvalRemediationSteps:
    @pytest.mark.asyncio
    async def test_remediation_steps_has_at_least_three_items(self):
        incident = {
            "id": "inc-eval-1",
            "title": "Multi-Stage Attack",
            "severity": "critical",
            "status": "open",
            "created_at": datetime(2024, 1, 1, 10, 29, 0, tzinfo=timezone.utc),
            "alert_ids": ["alert-eval-1"],
            "ai_remediation": None,
            "timeline": None,
        }
        alert = _make_a1_alert()
        stored_remediations: list[dict] = []

        def fake_update(inc_id, ai_remediation, timeline):
            stored_remediations.append(ai_remediation)

        llm_response = _incident_remediation()

        with (
            patch.object(a2, "_fetch_pending_incident", return_value=incident),
            patch.object(a2, "_fetch_alerts_by_ids", return_value=[alert]),
            patch.object(a2, "_fetch_events_by_ids", return_value=[]),
            patch.object(a2, "_update_incident", side_effect=fake_update),
            patch("agent2_incident_response.ollama_client.generate_json", return_value=llm_response),
        ):
            await a2._process_incident(incident)

        assert stored_remediations, "No remediation stored"
        steps = stored_remediations[0].get("remediation_steps", [])
        assert len(steps) >= 3, f"Expected ≥3 remediation steps, got {len(steps)}: {steps}"


# ---------------------------------------------------------------------------
# Eval: Agent 2 required fields present
# ---------------------------------------------------------------------------

class TestEvalAgent2RequiredFields:
    @pytest.mark.asyncio
    async def test_all_required_fields_present(self):
        incident = {
            "id": "inc-eval-2",
            "title": "SSH Brute Force Incident",
            "severity": "high",
            "status": "open",
            "created_at": datetime(2024, 1, 1, 10, 29, 0, tzinfo=timezone.utc),
            "alert_ids": ["alert-eval-1"],
            "ai_remediation": None,
            "timeline": None,
        }
        alert = _make_a1_alert()
        stored_remediations: list[dict] = []

        def fake_update(inc_id, ai_remediation, timeline):
            stored_remediations.append(ai_remediation)

        llm_response = _incident_remediation()

        with (
            patch.object(a2, "_fetch_pending_incident", return_value=incident),
            patch.object(a2, "_fetch_alerts_by_ids", return_value=[alert]),
            patch.object(a2, "_fetch_events_by_ids", return_value=[]),
            patch.object(a2, "_update_incident", side_effect=fake_update),
            patch("agent2_incident_response.ollama_client.generate_json", return_value=llm_response),
        ):
            await a2._process_incident(incident)

        assert stored_remediations
        result = stored_remediations[0]
        missing = AGENT2_REQUIRED_FIELDS - set(result.keys())
        assert not missing, f"Missing required fields in Agent 2 response: {missing}"


# ---------------------------------------------------------------------------
# Eval: timeline array must be in chronological order
# ---------------------------------------------------------------------------

class TestEvalTimelineChronologicalOrder:
    @pytest.mark.asyncio
    async def test_timeline_is_chronologically_ordered(self):
        incident = {
            "id": "inc-eval-3",
            "title": "Multi-Stage Incident",
            "severity": "critical",
            "status": "open",
            "created_at": datetime(2024, 1, 1, 10, 29, 0, tzinfo=timezone.utc),
            "alert_ids": ["alert-eval-1"],
            "ai_remediation": None,
            "timeline": None,
        }
        alert = _make_a1_alert()

        # Provide an already-sorted timeline from the LLM
        ordered_timeline = [
            {"time": "10:29:55Z", "event": "First SYN packet"},
            {"time": "10:30:01Z", "event": "Scan sweep"},
            {"time": "10:30:45Z", "event": "SSH brute force begins"},
            {"time": "10:31:10Z", "event": "Failed login recorded"},
        ]
        llm_response = _incident_remediation(timeline=ordered_timeline)

        stored_timelines: list = []

        def fake_update(inc_id, ai_remediation, timeline):
            stored_timelines.append(timeline)

        with (
            patch.object(a2, "_fetch_pending_incident", return_value=incident),
            patch.object(a2, "_fetch_alerts_by_ids", return_value=[alert]),
            patch.object(a2, "_fetch_events_by_ids", return_value=[]),
            patch.object(a2, "_update_incident", side_effect=fake_update),
            patch("agent2_incident_response.ollama_client.generate_json", return_value=llm_response),
        ):
            await a2._process_incident(incident)

        assert stored_timelines, "No timeline stored"
        timeline = stored_timelines[0]
        assert isinstance(timeline, list), "Timeline should be a list"
        assert len(timeline) >= 2, "Timeline should have multiple entries"

        times = [entry["time"] for entry in timeline]
        assert times == sorted(times), (
            f"Timeline is not in chronological order: {times}"
        )
