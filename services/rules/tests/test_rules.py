import sys
import os
from collections import deque
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import engine
from types_internal import NetworkEvent, Rule, WindowKey


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_event(
    src_ip: str = "1.2.3.4",
    dst_port: int | None = 80,
    protocol: str = "TCP",
    flags: str | None = None,
) -> NetworkEvent:
    return {
        "id": "evt-001",
        "src_ip": src_ip,
        "dst_ip": "10.0.0.1",
        "src_port": 12345,
        "dst_port": dst_port,
        "protocol": protocol,
        "bytes_sent": 100,
        "direction": "inbound",
        "interface": "eth0",
        "flags": flags,
    }


def make_rule(
    rule_id: str,
    metric: str,
    threshold: int,
    window_seconds: int = 60,
    **filters: int | str,
) -> Rule:
    config = {"metric": metric, "window_seconds": window_seconds, "threshold": threshold}
    config.update(filters)  # type: ignore[arg-type]
    return {"id": rule_id, "name": rule_id, "severity": "high", "config": config}  # type: ignore[return-value]


def reset_state() -> None:
    engine.windows.clear()
    engine.last_alert.clear()


# ── Port scan ─────────────────────────────────────────────────────────────────

def test_port_scan_fires_at_threshold() -> None:
    reset_state()
    rule = make_rule("port-scan-001", "unique_dst_ports", threshold=20)
    fired: bool = False
    related: list[str] = []
    for port in range(1, 21):
        event = make_event(dst_port=port)
        event["id"] = f"evt-{port}"
        fired, related = engine.evaluate_rule(rule, event)
    assert fired is True
    assert len(related) == 20


def test_port_scan_does_not_fire_below_threshold() -> None:
    reset_state()
    rule = make_rule("port-scan-001", "unique_dst_ports", threshold=20)
    fired: bool = False
    for port in range(1, 20):  # only 19 unique ports
        event = make_event(dst_port=port)
        event["id"] = f"evt-{port}"
        fired, _ = engine.evaluate_rule(rule, event)
    assert fired is False


# ── SSH brute force ───────────────────────────────────────────────────────────

def test_ssh_bruteforce_fires_correctly() -> None:
    reset_state()
    rule = make_rule(
        "ssh-bruteforce-001", "event_count", threshold=10, window_seconds=30,
        filter_dst_port=22, filter_protocol="TCP", filter_flags="SYN",
    )
    fired: bool = False
    for i in range(10):
        event = make_event(dst_port=22, protocol="TCP", flags="SYN")
        event["id"] = f"evt-{i}"
        fired, _ = engine.evaluate_rule(rule, event)
    assert fired is True


def test_ssh_bruteforce_ignores_non_syn() -> None:
    reset_state()
    rule = make_rule(
        "ssh-bruteforce-001", "event_count", threshold=10, window_seconds=30,
        filter_dst_port=22, filter_protocol="TCP", filter_flags="SYN",
    )
    fired: bool = False
    for i in range(10):
        event = make_event(dst_port=22, protocol="TCP", flags="ACK")  # not SYN
        event["id"] = f"evt-{i}"
        fired, _ = engine.evaluate_rule(rule, event)
    assert fired is False


# ── Duplicate prevention ──────────────────────────────────────────────────────

def test_duplicate_prevention_blocks_second_alert() -> None:
    reset_state()
    rule = make_rule("high-traffic-001", "event_count", threshold=5, window_seconds=60)

    for i in range(5):
        event = make_event()
        event["id"] = f"evt-{i}"
        engine.evaluate_rule(rule, event)

    key: WindowKey = (rule["id"], "1.2.3.4")
    engine.last_alert[key] = datetime.now(timezone.utc)

    event = make_event()
    event["id"] = "evt-extra"
    fired, _ = engine.evaluate_rule(rule, event)
    assert fired is False


# ── Sliding window expiry ─────────────────────────────────────────────────────

def test_sliding_window_expires_old_entries() -> None:
    reset_state()
    rule = make_rule("port-scan-001", "unique_dst_ports", threshold=20, window_seconds=5)

    key: WindowKey = (rule["id"], "1.2.3.4")
    engine.windows[key] = deque()
    old_time: datetime = datetime.now(timezone.utc) - timedelta(seconds=10)
    for port in range(1, 20):
        engine.windows[key].append((old_time, f"evt-old-{port}", port))

    event = make_event(dst_port=99)
    event["id"] = "evt-new"
    fired, _ = engine.evaluate_rule(rule, event)
    assert fired is False  # only 1 entry after expiry, threshold not met


# ── filter_dst_port ───────────────────────────────────────────────────────────

def test_filter_dst_port_excludes_non_matching() -> None:
    reset_state()
    rule = make_rule(
        "dns-unusual-001", "event_count", threshold=5, window_seconds=60,
        filter_dst_port=53, filter_protocol="UDP",
    )
    fired: bool = False
    for i in range(5):
        event = make_event(dst_port=80, protocol="UDP")  # wrong port
        event["id"] = f"evt-{i}"
        fired, _ = engine.evaluate_rule(rule, event)
    assert fired is False


# ── filter_protocol ───────────────────────────────────────────────────────────

def test_filter_protocol_excludes_non_matching() -> None:
    reset_state()
    rule = make_rule(
        "icmp-flood-001", "event_count", threshold=5, window_seconds=10,
        filter_protocol="ICMP",
    )
    fired: bool = False
    for i in range(5):
        event = make_event(protocol="TCP")  # wrong protocol
        event["id"] = f"evt-{i}"
        fired, _ = engine.evaluate_rule(rule, event)
    assert fired is False


# ── Loader ────────────────────────────────────────────────────────────────────

def test_loader_inserts_rules_not_in_db() -> None:
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value = mock_cursor
    mock_cursor.fetchone.return_value = None  # rule not in DB

    from loader import load_default_rules
    load_default_rules(mock_conn)

    assert mock_cursor.execute.call_count > 5  # SELECT + INSERT for each rule
    mock_conn.commit.assert_called_once()


def test_loader_skips_existing_rules() -> None:
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_conn.cursor.return_value = mock_cursor
    mock_cursor.fetchone.return_value = ("existing-id",)  # rule already exists

    from loader import load_default_rules
    load_default_rules(mock_conn)

    for call in mock_cursor.execute.call_args_list:
        assert "INSERT" not in call[0][0]
