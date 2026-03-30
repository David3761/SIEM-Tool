import asyncio
import json
import logging
import os
import time

import httpx
import psycopg2
import redis

from parsers.packet_parser import parse_packet

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("sniffer")

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://siem:siempassword@postgres:5432/siem")
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")
CAPTURE_MODE = os.environ.get("CAPTURE_MODE", "live")

DEFAULT_CONFIG: dict = {
    "monitored_interfaces": ["eth0", "wlan0"],
    "monitored_subnets": ["192.168.1.0/24", "10.0.0.0/8"],
    "excluded_ips": [],
}

INSERT_SQL = """
INSERT INTO network_events
  (timestamp, src_ip, dst_ip, src_port, dst_port,
   protocol, bytes_sent, direction, interface, flags)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

def _apply_defaults(config: dict) -> dict:
    result = dict(config)
    for key, default in DEFAULT_CONFIG.items():
        if not result.get(key):
            result[key] = default
            logger.info("Config field '%s' is empty — using default: %s", key, default)
    return result


async def fetch_config(client: httpx.AsyncClient) -> dict:
    for attempt in range(3):
        try:
            resp = await client.get(f"{BACKEND_URL}/api/config", timeout=5.0)
            resp.raise_for_status()
            return _apply_defaults(resp.json())
        except Exception as exc:
            logger.warning("Config fetch attempt %d failed: %s", attempt + 1, exc)
            if attempt < 2:
                await asyncio.sleep(2 ** attempt)
    logger.warning("All config fetch attempts failed — using last known config")
    return DEFAULT_CONFIG


# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def connect_db() -> psycopg2.extensions.connection:
    return psycopg2.connect(DATABASE_URL)


def bulk_insert(conn: psycopg2.extensions.connection, events: list[dict]) -> None:
    if not events:
        return
    rows = [
        (
            e["timestamp"], e["src_ip"], e["dst_ip"],
            e.get("src_port"), e.get("dst_port"), e["protocol"],
            e["bytes_sent"], e["direction"], e["interface"],
            e.get("flags"),
        )
        for e in events
    ]
    with conn.cursor() as cur:
        cur.executemany(INSERT_SQL, rows)
    conn.commit()
    logger.info("Bulk inserted %d events", len(events))


# ---------------------------------------------------------------------------
# Capture modes
# ---------------------------------------------------------------------------

async def _run_simulate(config: dict, queue: asyncio.Queue) -> None:
    from simulator import generate_traffic
    async for event in generate_traffic():
        await queue.put(event)


async def _run_live(config: dict, queue: asyncio.Queue) -> None:
    from scapy.all import AsyncSniffer, get_if_list

    available = get_if_list()
    interfaces = [i for i in config.get("monitored_interfaces", ["eth0", "wlan0"]) if i in available]
    skipped = set(config.get("monitored_interfaces", [])) - set(interfaces)
    if skipped:
        logger.warning("Interfaces not found, skipping: %s", skipped)
    if not interfaces:
        logger.error("No valid interfaces to capture on — exiting")
        return
    loop = asyncio.get_event_loop()

    def _callback(packet):
        subnets = config.get("monitored_subnets", [])
        excluded = config.get("excluded_ips", [])
        parsed = parse_packet(packet, subnets)
        if parsed is None:
            return
        if parsed["src_ip"] in excluded or parsed["dst_ip"] in excluded:
            return
        if hasattr(packet, "sniffed_on"):
            parsed["interface"] = packet.sniffed_on
        loop.call_soon_threadsafe(queue.put_nowait, parsed)

    sniffer = AsyncSniffer(iface=interfaces, prn=_callback, store=False)
    sniffer.start()
    logger.info("Live capture started on interfaces: %s", interfaces)
    try:
        while True:
            await asyncio.sleep(1)
    finally:
        sniffer.stop()
        logger.info("Live capture stopped")


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

async def main() -> None:
    event_queue: asyncio.Queue = asyncio.Queue()
    event_buffer: list[dict] = []
    last_flush = time.monotonic()
    last_config_refresh = time.monotonic()

    async with httpx.AsyncClient() as http_client:
        config = await fetch_config(http_client)
        logger.info("Startup config: %s", config)

        redis_client = redis.from_url(REDIS_URL)

        db_conn: psycopg2.extensions.connection | None = None
        try:
            db_conn = connect_db()
        except Exception as exc:
            logger.error("Initial DB connection failed: %s", exc)

        if CAPTURE_MODE == "simulate":
            capture_task = asyncio.create_task(_run_simulate(config, event_queue))
        else:
            capture_task = asyncio.create_task(_run_live(config, event_queue))

        packets_published = 0
        try:
            while True:
                now = time.monotonic()

                # --- Config refresh every 60 seconds ---
                if now - last_config_refresh >= 60:
                    try:
                        fresh = await fetch_config(http_client)
                        config.update(fresh)
                        last_config_refresh = now
                        logger.info("Config refreshed")
                    except Exception as exc:
                        logger.warning("Config refresh error: %s", exc)

                # --- Drain the event queue ---
                drained = 0
                while not event_queue.empty():
                    event = event_queue.get_nowait()
                    try:
                        redis_client.publish("traffic:events", json.dumps(event))
                        packets_published += 1
                        if packets_published % 10 == 0:
                            logger.info(
                                "Published %d packets to Redis (last: %s -> %s %s)",
                                packets_published,
                                event.get("src_ip"), event.get("dst_ip"),
                                event.get("protocol"),
                            )
                    except Exception as exc:
                        logger.error("Redis publish failed: %s", exc)
                    event_buffer.append(event)
                    drained += 1

                # --- Bulk flush every 5 seconds ---
                if now - last_flush >= 5:
                    if event_buffer:
                        if db_conn is None:
                            try:
                                db_conn = connect_db()
                            except Exception as exc:
                                logger.error("DB reconnect failed: %s", exc)
                        if db_conn is not None:
                            try:
                                bulk_insert(db_conn, event_buffer)
                                event_buffer.clear()
                            except Exception as exc:
                                logger.error("Bulk insert failed: %s", exc)
                                try:
                                    db_conn.close()
                                except Exception:
                                    pass
                                db_conn = None
                    last_flush = now

                await asyncio.sleep(0.01)

        finally:
            capture_task.cancel()
            try:
                await capture_task
            except asyncio.CancelledError:
                pass

            if event_buffer and db_conn is not None:
                try:
                    bulk_insert(db_conn, event_buffer)
                except Exception as exc:
                    logger.error("Final flush failed: %s", exc)

            if db_conn is not None:
                db_conn.close()


if __name__ == "__main__":
    asyncio.run(main())
