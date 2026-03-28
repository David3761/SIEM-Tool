"""
Tests for the network capture service.
Redis and PostgreSQL interactions are mocked with unittest.mock.
Packet parsing uses real scapy objects.
"""
import asyncio
import json
import sys
import os
from unittest.mock import MagicMock, patch, call

import pytest

# Make sure the capture package root is on the path when running from any directory.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scapy.layers.inet import IP, TCP, UDP, ICMP
from scapy.layers.l2 import ARP, Ether

from parsers.packet_parser import parse_packet, determine_direction, ip_in_subnet

SUBNETS = ["192.168.1.0/24", "10.0.0.0/8"]

# ---------------------------------------------------------------------------
# packet_parser tests
# ---------------------------------------------------------------------------

class TestParsePacketTcpSyn:
    def test_fields_present(self):
        pkt = Ether() / IP(src="192.168.1.10", dst="8.8.8.8") / TCP(sport=54321, dport=443, flags="S")
        result = parse_packet(pkt, SUBNETS)

        assert result is not None
        assert result["src_ip"] == "192.168.1.10"
        assert result["dst_ip"] == "8.8.8.8"
        assert result["protocol"] == "TCP"
        assert result["src_port"] == 54321
        assert result["dst_port"] == 443
        assert result["flags"] == "SYN"
        assert result["direction"] == "outbound"
        assert result["bytes_sent"] == len(pkt)
        assert "id" in result
        assert "timestamp" in result

    def test_syn_ack_flag(self):
        pkt = Ether() / IP(src="8.8.8.8", dst="192.168.1.10") / TCP(sport=443, dport=54321, flags="SA")
        result = parse_packet(pkt, SUBNETS)
        assert result["flags"] == "SYN-ACK"

    def test_rst_flag(self):
        pkt = Ether() / IP(src="192.168.1.10", dst="8.8.8.8") / TCP(flags="R")
        result = parse_packet(pkt, SUBNETS)
        assert result["flags"] == "RST"

    def test_fin_flag(self):
        pkt = Ether() / IP(src="192.168.1.10", dst="8.8.8.8") / TCP(flags="F")
        result = parse_packet(pkt, SUBNETS)
        assert result["flags"] == "FIN"


class TestParsePacketUdp:
    def test_fields_present(self):
        pkt = Ether() / IP(src="192.168.1.55", dst="1.1.1.1") / UDP(sport=12345, dport=53)
        result = parse_packet(pkt, SUBNETS)

        assert result is not None
        assert result["protocol"] == "UDP"
        assert result["src_port"] == 12345
        assert result["dst_port"] == 53
        assert result["flags"] is None
        assert result["direction"] == "outbound"

    def test_bytes_sent(self):
        pkt = Ether() / IP(src="192.168.1.55", dst="1.1.1.1") / UDP(sport=12345, dport=53)
        result = parse_packet(pkt, SUBNETS)
        assert result["bytes_sent"] == len(pkt)


class TestParsePacketNonIp:
    def test_arp_returns_none(self):
        pkt = Ether() / ARP()
        result = parse_packet(pkt, SUBNETS)
        assert result is None

    def test_bare_ethernet_returns_none(self):
        pkt = Ether()
        result = parse_packet(pkt, SUBNETS)
        assert result is None


class TestParsePacketIcmp:
    def test_icmp_ports_are_none(self):
        pkt = Ether() / IP(src="10.0.0.5", dst="8.8.8.8") / ICMP()
        result = parse_packet(pkt, SUBNETS)

        assert result is not None
        assert result["protocol"] == "ICMP"
        assert result["src_port"] is None
        assert result["dst_port"] is None
        assert result["flags"] is None


# ---------------------------------------------------------------------------
# determine_direction tests
# ---------------------------------------------------------------------------

class TestDetermineDirection:
    def test_outbound(self):
        # Internal src, external dst
        assert determine_direction("192.168.1.10", "8.8.8.8", SUBNETS) == "outbound"

    def test_inbound(self):
        # External src, internal dst
        assert determine_direction("8.8.8.8", "192.168.1.10", SUBNETS) == "inbound"

    def test_internal(self):
        # Both IPs are in monitored subnets
        assert determine_direction("192.168.1.10", "10.0.0.5", SUBNETS) == "internal"

    def test_external_to_external_defaults_outbound(self):
        # Neither IP in subnets → falls back to outbound
        assert determine_direction("8.8.8.8", "1.1.1.1", SUBNETS) == "outbound"


# ---------------------------------------------------------------------------
# ip_in_subnet tests
# ---------------------------------------------------------------------------

class TestIpInSubnet:
    def test_ip_in_subnet(self):
        assert ip_in_subnet("192.168.1.100", "192.168.1.0/24") is True

    def test_ip_not_in_subnet(self):
        assert ip_in_subnet("8.8.8.8", "192.168.1.0/24") is False


# ---------------------------------------------------------------------------
# Simulator tests
# ---------------------------------------------------------------------------

class TestSimulator:
    def test_event_has_required_fields(self):
        from simulator import generate_traffic

        REQUIRED_FIELDS = {
            "id", "timestamp", "src_ip", "dst_ip", "src_port",
            "dst_port", "protocol", "bytes_sent", "direction",
            "interface", "flags",
        }

        async def _get_event():
            async for event in generate_traffic():
                return event

        event = asyncio.run(_get_event())
        assert event is not None
        assert REQUIRED_FIELDS == set(event.keys())

    def test_multiple_events_have_required_fields(self):
        from simulator import generate_traffic

        REQUIRED_FIELDS = {
            "id", "timestamp", "src_ip", "dst_ip", "src_port",
            "dst_port", "protocol", "bytes_sent", "direction",
            "interface", "flags",
        }

        async def _get_events(n: int):
            events = []
            async for event in generate_traffic():
                events.append(event)
                if len(events) >= n:
                    break
            return events

        events = asyncio.run(_get_events(10))
        assert len(events) == 10
        for ev in events:
            assert REQUIRED_FIELDS == set(ev.keys())

    def test_events_are_json_serializable(self):
        from simulator import generate_traffic

        async def _get_event():
            async for event in generate_traffic():
                return event

        event = asyncio.run(_get_event())
        serialized = json.dumps(event)
        deserialized = json.loads(serialized)
        assert deserialized["id"] == event["id"]

    def test_event_ids_are_unique(self):
        from simulator import generate_traffic

        async def _get_events(n: int):
            ids = []
            async for event in generate_traffic():
                ids.append(event["id"])
                if len(ids) >= n:
                    break
            return ids

        ids = asyncio.run(_get_events(20))
        assert len(set(ids)) == 20


# ---------------------------------------------------------------------------
# Bulk insert tests
# ---------------------------------------------------------------------------

def _make_test_event(i: int = 0) -> dict:
    return {
        "id": f"00000000-0000-0000-0000-{i:012d}",
        "timestamp": "2024-01-15T10:30:00.000000+00:00",
        "src_ip": "192.168.1.10",
        "dst_ip": "8.8.8.8",
        "src_port": 54321,
        "dst_port": 443,
        "protocol": "TCP",
        "bytes_sent": 1500,
        "direction": "outbound",
        "interface": "eth0",
        "flags": "SYN",
    }


class TestBulkInsert:
    def test_ten_events_single_executemany_call(self):
        from sniffer import bulk_insert

        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        events = [_make_test_event(i) for i in range(10)]
        bulk_insert(mock_conn, events)

        mock_cursor.executemany.assert_called_once()
        _, rows = mock_cursor.executemany.call_args[0]
        assert len(rows) == 10

    def test_empty_list_does_not_call_executemany(self):
        from sniffer import bulk_insert

        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        bulk_insert(mock_conn, [])

        mock_cursor.executemany.assert_not_called()
        mock_conn.commit.assert_not_called()

    def test_rows_contain_all_required_fields(self):
        from sniffer import bulk_insert

        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        events = [_make_test_event(0)]
        bulk_insert(mock_conn, events)

        _, rows = mock_cursor.executemany.call_args[0]
        row = rows[0]
        # 11 columns: id, timestamp, src_ip, dst_ip, src_port, dst_port,
        #             protocol, bytes_sent, direction, interface, flags
        assert len(row) == 11
        assert row[0] == events[0]["id"]
        assert row[6] == "TCP"

    def test_commit_called_after_insert(self):
        from sniffer import bulk_insert

        mock_cursor = MagicMock()
        mock_conn = MagicMock()
        mock_conn.cursor.return_value.__enter__ = MagicMock(return_value=mock_cursor)
        mock_conn.cursor.return_value.__exit__ = MagicMock(return_value=False)

        bulk_insert(mock_conn, [_make_test_event()])
        mock_conn.commit.assert_called_once()
