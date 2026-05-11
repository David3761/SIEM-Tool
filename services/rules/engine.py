import asyncio
import json
import logging
import os
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any

import psycopg2
import psycopg2.extensions
import psycopg2.extras
import redis.asyncio as aioredis
from typing import cast

from loader import load_default_rules
from types_internal import AlertDict, NetworkEvent, Rule, WindowEntry, WindowKey

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

DATABASE_URL: str = os.environ.get("DATABASE_URL", "postgresql://siem:siempassword@postgres:5432/siem")
REDIS_URL: str = os.environ.get("REDIS_URL", "redis://redis:6379")

# In-memory sliding window state
windows: dict[WindowKey, deque[WindowEntry]] = {}
last_alert: dict[WindowKey, datetime] = {}

ALERT_COOLDOWN_SECONDS: int = 60
RULE_RELOAD_INTERVAL: int = 300  # 5 minutes


def get_db_conn() -> psycopg2.extensions.connection:
    return psycopg2.connect(DATABASE_URL)


def load_rules_from_db(conn: psycopg2.extensions.connection) -> list[Rule]:
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute("SELECT * FROM rules WHERE enabled = true")
    rows: list[Any] = cursor.fetchall()
    cursor.close()
    return cast(list[Rule], [dict(r) for r in rows])


def evaluate_rule(rule: Rule, event: NetworkEvent) -> tuple[bool, list[str]]:
    key: WindowKey = (rule["id"], event["src_ip"])
    now: datetime = datetime.now(timezone.utc)
    window_secs: int = rule["config"]["window_seconds"]

    # Duplicate prevention: skip if we fired this rule for this src_ip recently
    if key in last_alert and (now - last_alert[key]).total_seconds() < ALERT_COOLDOWN_SECONDS:
        return False, []

    if key not in windows:
        windows[key] = deque()

    # Expire entries outside the window
    while windows[key] and (now - windows[key][0][0]).total_seconds() > window_secs:
        windows[key].popleft()

    cfg = rule["config"]

    # Apply optional filters (AND logic)
    if "filter_dst_port" in cfg and event.get("dst_port") != cfg["filter_dst_port"]:
        return False, []
    if "filter_protocol" in cfg and event.get("protocol") != cfg["filter_protocol"]:
        return False, []
    if "filter_flags" in cfg and event.get("flags") != cfg["filter_flags"]:
        return False, []

    metric_value: int | None = (
        event.get("dst_port") if cfg["metric"] == "unique_dst_ports" else 1
    )
    entry: WindowEntry = (now, event["id"], metric_value)
    windows[key].append(entry)

    count: int
    if cfg["metric"] == "unique_dst_ports":
        count = len(set(e[2] for e in windows[key]))
    else:
        count = len(windows[key])

    if count >= cfg["threshold"]:
        last_alert[key] = now
        related_ids: list[str] = [e[1] for e in windows[key]]
        return True, related_ids

    return False, []


def insert_alert(
    conn: Any,  # Any to stay compatible with MagicMock in tests
    rule: Rule,
    event: NetworkEvent,
    related_ids: list[str],
) -> AlertDict:
    alert_id: str = str(uuid.uuid4())
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO alerts
          (id, rule_id, rule_name, severity, timestamp, status,
           triggering_event_id, related_event_ids, ai_analysis, incident_id)
        VALUES
          (%s, %s, %s, %s, NOW(), 'open', %s, %s::jsonb, NULL, NULL)
        """,
        (
            alert_id,
            rule["id"],
            rule["name"],
            rule["severity"],
            event["id"],
            json.dumps(related_ids),
        ),
    )
    conn.commit()
    cursor.close()

    return {
        "id": alert_id,
        "rule_id": rule["id"],
        "rule_name": rule["name"],
        "severity": rule["severity"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": "open",
        "triggering_event_id": event["id"],
        "related_event_ids": related_ids,
        "ai_analysis": None,
        "incident_id": None,
    }


async def run() -> None:
    conn: psycopg2.extensions.connection = get_db_conn()
    load_default_rules(conn)
    rules: list[Rule] = load_rules_from_db(conn)
    log.info("Loaded %d rules from database", len(rules))

    redis = await aioredis.from_url(REDIS_URL, decode_responses=True)
    pubsub = redis.pubsub()
    await pubsub.subscribe("traffic:events")
    log.info("Subscribed to traffic:events")

    last_reload: float = asyncio.get_event_loop().time()
    packets_received: int = 0

    async for message in pubsub.listen():
        if message["type"] != "message":
            continue

        now_ts: float = asyncio.get_event_loop().time()
        if now_ts - last_reload > RULE_RELOAD_INTERVAL:
            rules = load_rules_from_db(conn)
            log.info("Reloaded %d rules from database", len(rules))
            last_reload = now_ts

        event: NetworkEvent
        try:
            event = json.loads(message["data"])
        except json.JSONDecodeError:
            log.warning("Received invalid JSON from traffic:events")
            continue

        packets_received += 1
        if packets_received % 10 == 0:
            log.info(
                "Received %d packets from Redis (last: %s -> %s %s)",
                packets_received,
                event.get("src_ip"), event.get("dst_ip"),
                event.get("protocol"),
            )

        rule: Rule
        for rule in rules:
            fired: bool
            related_ids: list[str]
            fired, related_ids = evaluate_rule(rule, event)
            if not fired:
                continue

            alert: AlertDict = insert_alert(conn, rule, event, related_ids)
            await redis.publish("alerts:new", json.dumps(alert))
            log.info("Alert fired: %s for src_ip=%s", rule["name"], event.get("src_ip"))


if __name__ == "__main__":
    asyncio.run(run())