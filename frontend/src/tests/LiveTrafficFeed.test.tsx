import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LiveTrafficFeed } from "../components/dashboard/LiveTrafficFeed";
import type { NetworkEvent } from "../types";

function makeEvent(id: string, overrides: Partial<NetworkEvent> = {}): NetworkEvent {
  return {
    id,
    timestamp: new Date().toISOString(),
    src_ip: `10.0.0.${id}`,
    dst_ip: "192.168.1.1",
    src_port: 12345,
    dst_port: 80,
    protocol: "TCP",
    bytes_sent: 512,
    direction: "inbound",
    interface: "eth0",
    flags: null,
    ...overrides,
  };
}

describe("LiveTrafficFeed", () => {
  it("shows waiting message when events list is empty", () => {
    render(<LiveTrafficFeed events={[]} />);
    expect(screen.getByText(/Waiting for traffic/i)).toBeInTheDocument();
  });

  it("renders event rows with correct IP addresses", () => {
    const events = [makeEvent("1"), makeEvent("2")];
    render(<LiveTrafficFeed events={events} />);
    // Both source IPs should appear in the document
    expect(screen.getByText(/10\.0\.0\.1.*192\.168\.1\.1/)).toBeInTheDocument();
    expect(screen.getByText(/10\.0\.0\.2.*192\.168\.1\.1/)).toBeInTheDocument();
  });

  it("shows the correct event count in the header", () => {
    const events = [makeEvent("1"), makeEvent("2"), makeEvent("3")];
    render(<LiveTrafficFeed events={events} />);
    expect(screen.getByText("3 events")).toBeInTheDocument();
  });

  it("renders all 100 events when exactly 100 are provided", () => {
    const events = Array.from({ length: 100 }, (_, i) => makeEvent(String(i + 1)));
    render(<LiveTrafficFeed events={events} />);
    expect(screen.getByText("100 events")).toBeInTheDocument();
  });

  it("renders protocol labels", () => {
    const events = [
      makeEvent("1", { protocol: "TCP" }),
      makeEvent("2", { protocol: "UDP" }),
    ];
    render(<LiveTrafficFeed events={events} />);
    expect(screen.getByText("TCP")).toBeInTheDocument();
    expect(screen.getByText("UDP")).toBeInTheDocument();
  });
});
