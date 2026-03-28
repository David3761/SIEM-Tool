import ipaddress
import uuid
from datetime import datetime, timezone

from scapy.layers.inet import IP, TCP, UDP, ICMP


def ip_in_subnet(ip: str, subnet: str) -> bool:
    return ipaddress.ip_address(ip) in ipaddress.ip_network(subnet, strict=False)


def _parse_flags(flags_int: int) -> str | None:
    syn = bool(flags_int & 0x02)
    ack = bool(flags_int & 0x10)
    rst = bool(flags_int & 0x04)
    fin = bool(flags_int & 0x01)
    psh = bool(flags_int & 0x08)

    # Named combinations first
    if syn and ack:
        return "SYN-ACK"

    parts = []
    if syn:
        parts.append("SYN")
    if ack:
        parts.append("ACK")
    if rst:
        parts.append("RST")
    if fin:
        parts.append("FIN")
    if psh:
        parts.append("PSH")

    return "-".join(parts) if parts else None


def determine_direction(src_ip: str, dst_ip: str, monitored_subnets: list[str]) -> str:
    src_internal = any(ip_in_subnet(src_ip, s) for s in monitored_subnets)
    dst_internal = any(ip_in_subnet(dst_ip, s) for s in monitored_subnets)

    if src_internal and dst_internal:
        return "internal"
    if src_internal:
        return "outbound"
    if dst_internal:
        return "inbound"
    return "outbound"


def parse_packet(packet, monitored_subnets: list[str]) -> dict | None:
    if not packet.haslayer(IP):
        return None

    ip_layer = packet[IP]
    src_ip: str = ip_layer.src
    dst_ip: str = ip_layer.dst
    bytes_sent: int = len(packet)

    src_port = None
    dst_port = None
    protocol = "OTHER"
    flags = None

    if packet.haslayer(TCP):
        protocol = "TCP"
        tcp_layer = packet[TCP]
        src_port = tcp_layer.sport
        dst_port = tcp_layer.dport
        flags = _parse_flags(int(tcp_layer.flags))
    elif packet.haslayer(UDP):
        protocol = "UDP"
        udp_layer = packet[UDP]
        src_port = udp_layer.sport
        dst_port = udp_layer.dport
    elif packet.haslayer(ICMP):
        protocol = "ICMP"

    direction = determine_direction(src_ip, dst_ip, monitored_subnets)

    return {
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "src_ip": src_ip,
        "dst_ip": dst_ip,
        "src_port": src_port,
        "dst_port": dst_port,
        "protocol": protocol,
        "bytes_sent": bytes_sent,
        "direction": direction,
        "interface": "",
        "flags": flags,
    }
