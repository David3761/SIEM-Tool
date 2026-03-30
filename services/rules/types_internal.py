from datetime import datetime
from typing import TypedDict


# ── Rule ──────────────────────────────────────────────────────────────────────

class _RuleConfigRequired(TypedDict):
    metric: str          # "event_count" | "unique_dst_ports"
    window_seconds: int
    threshold: int


class RuleConfig(_RuleConfigRequired, total=False):
    filter_dst_port: int
    filter_protocol: str
    filter_flags: str


class _RuleRequired(TypedDict):
    id: str
    name: str
    severity: str
    config: RuleConfig


class Rule(_RuleRequired, total=False):
    description: str
    rule_type: str
    enabled: bool
    created_at: str


# ── Network event (as published by Teammate 2 on traffic:events) ───────────

class _NetworkEventRequired(TypedDict):
    id: str
    src_ip: str
    dst_ip: str
    protocol: str
    bytes_sent: int
    direction: str
    interface: str


class NetworkEvent(_NetworkEventRequired, total=False):
    timestamp: str
    src_port: int | None
    dst_port: int | None
    flags: str | None


# ── Alert (published to alerts:new and stored in PostgreSQL) ──────────────

class AlertDict(TypedDict):
    rule_id: str
    rule_name: str
    severity: str
    timestamp: str
    status: str
    triggering_event_id: str
    related_event_ids: list[str]
    ai_analysis: None
    incident_id: None


# ── Sliding window internals ──────────────────────────────────────────────

# (rule_id, src_ip)
WindowKey = tuple[str, str]

# (timestamp, event_id, metric_value)
# metric_value is the dst_port for unique_dst_ports metric, 1 for event_count
WindowEntry = tuple[datetime, str, int | None]
