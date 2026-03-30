import asyncio
import ipaddress
import random
import uuid
from datetime import datetime, timezone

INTERNAL_IPS = ["192.168.1.100", "192.168.1.55", "192.168.1.10", "10.0.0.5"]
EXTERNAL_IPS = ["8.8.8.8", "1.1.1.1", "142.250.74.14"]
COMMON_PORTS = [80, 443, 22, 53, 8080, 3306, 5432]
MONITORED_SUBNETS = ["192.168.1.0/24", "10.0.0.0/8"]

ALL_IPS = INTERNAL_IPS + EXTERNAL_IPS


def _ip_in_subnets(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    return any(addr in ipaddress.ip_network(s, strict=False) for s in MONITORED_SUBNETS)


def _direction(src_ip: str, dst_ip: str) -> str:
    src_internal = _ip_in_subnets(src_ip)
    dst_internal = _ip_in_subnets(dst_ip)
    if src_internal and dst_internal:
        return "internal"
    if src_internal:
        return "outbound"
    if dst_internal:
        return "inbound"
    return "outbound"


def _make_event(
    src_ip: str,
    dst_ip: str,
    protocol: str,
    src_port: int | None = None,
    dst_port: int | None = None,
    flags: str | None = None,
    interface: str = "eth0",
) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "src_ip": src_ip,
        "dst_ip": dst_ip,
        "src_port": src_port,
        "dst_port": dst_port,
        "protocol": protocol,
        "bytes_sent": random.randint(64, 1500),
        "direction": _direction(src_ip, dst_ip),
        "interface": interface,
        "flags": flags,
    }


async def generate_traffic():
    """Async generator yielding ~100 network events per second with injected attack scenarios."""
    loop = asyncio.get_event_loop()
    start = loop.time()

    next_port_scan = start + 30.0
    next_brute_force = start + 45.0

    # Each entry: (emit_at_monotonic_time, src_ip, dst_ip)
    brute_force_queue: list[tuple[float, str, str]] = []

    while True:
        now = loop.time()

        # --- Port scan injection: 25 SYN packets to random ports in quick succession ---
        if now >= next_port_scan:
            next_port_scan += 30.0
            src_ip = "192.168.1.100"
            dst_ip = random.choice(EXTERNAL_IPS)
            ports = random.sample(range(1, 65536), 25)
            for port in ports:
                yield _make_event(
                    src_ip, dst_ip, "TCP",
                    src_port=random.randint(49152, 65535),
                    dst_port=port,
                    flags="SYN",
                )
                await asyncio.sleep(0.04)  # 25 packets over ~1 second

        # --- SSH brute force: schedule 15 SYNs to port 22 spread over 15 seconds ---
        if now >= next_brute_force:
            next_brute_force += 45.0
            src_ip = "192.168.1.100"
            dst_ip = random.choice(EXTERNAL_IPS)
            for i in range(15):
                brute_force_queue.append((now + float(i), src_ip, dst_ip))

        # Emit any due brute force packets
        due = [item for item in brute_force_queue if item[0] <= now]
        brute_force_queue = [item for item in brute_force_queue if item[0] > now]
        for _, src, dst in due:
            yield _make_event(
                src, dst, "TCP",
                src_port=random.randint(49152, 65535),
                dst_port=22,
                flags="SYN",
            )

        # --- Normal random traffic ---
        src_ip = random.choice(ALL_IPS)
        dst_ip = random.choice(ALL_IPS)

        protocol = random.choices(["TCP", "UDP", "ICMP"], weights=[60, 30, 10])[0]

        if protocol == "TCP":
            yield _make_event(
                src_ip, dst_ip, protocol,
                src_port=random.randint(49152, 65535),
                dst_port=random.choice(COMMON_PORTS),
                flags=random.choice(["SYN", "ACK", "SYN-ACK", "FIN", "PSH"]),
            )
        elif protocol == "UDP":
            yield _make_event(
                src_ip, dst_ip, protocol,
                src_port=random.randint(49152, 65535),
                dst_port=random.choice(COMMON_PORTS),
            )
        else:
            yield _make_event(src_ip, dst_ip, protocol)

        await asyncio.sleep(0.01)  # ~100 events/second
