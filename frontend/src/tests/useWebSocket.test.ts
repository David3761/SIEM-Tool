import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWebSocket } from "../hooks/useWebSocket";
import type { NetworkEvent, Alert } from "../types";

// Minimal EventSource mock — the hook uses SSE (Mercure), not WebSocket.
class MockEventSource {
  static instances: MockEventSource[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(public url: string) {
    MockEventSource.instances.push(this);
    // Async-simulate connection open on the next tick
    setTimeout(() => this.onopen?.(), 0);
  }

  close() {
    this.closed = true;
  }

  simulateMessage(data: object) {
    const event = new MessageEvent("message", { data: JSON.stringify(data) });
    this.onmessage?.(event);
  }

  simulateError() {
    this.onerror?.();
  }
}

let originalEventSource: typeof EventSource | undefined;

beforeEach(() => {
  MockEventSource.instances = [];
  originalEventSource = (globalThis as { EventSource?: typeof EventSource }).EventSource;
  (globalThis as unknown as { EventSource: typeof MockEventSource }).EventSource =
    MockEventSource as unknown as typeof EventSource;
  vi.useFakeTimers();
});

afterEach(() => {
  if (originalEventSource) {
    (globalThis as unknown as { EventSource: typeof EventSource }).EventSource = originalEventSource;
  } else {
    delete (globalThis as unknown as { EventSource?: typeof EventSource }).EventSource;
  }
  vi.useRealTimers();
  vi.clearAllTimers();
});

describe("useWebSocket (SSE)", () => {
  it("returns isConnected=false initially and true after onopen", async () => {
    const { result } = renderHook(() => useWebSocket({}));

    expect(result.current.isConnected).toBe(false);

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it("calls onTrafficEvent when a traffic_event message is received", async () => {
    const onTrafficEvent = vi.fn();
    renderHook(() => useWebSocket({ onTrafficEvent }));

    await act(async () => { vi.runAllTimers(); });

    const es = MockEventSource.instances[0];
    const mockEvent: Partial<NetworkEvent> = {
      id: "evt-1",
      src_ip: "1.2.3.4",
      dst_ip: "5.6.7.8",
      protocol: "TCP",
    };

    act(() => {
      es.simulateMessage({ type: "traffic_event", data: mockEvent });
    });

    expect(onTrafficEvent).toHaveBeenCalledWith(mockEvent);
  });

  it("calls onNewAlert when a new_alert message is received", async () => {
    const onNewAlert = vi.fn();
    renderHook(() => useWebSocket({ onNewAlert }));

    await act(async () => { vi.runAllTimers(); });

    const es = MockEventSource.instances[0];
    const mockAlert: Partial<Alert> = {
      id: "alert-1",
      rule_name: "Port Scan",
      severity: "high",
    };

    act(() => {
      es.simulateMessage({ type: "new_alert", data: mockAlert });
    });

    expect(onNewAlert).toHaveBeenCalledWith(mockAlert);
  });

  it("calls onAlertUpdated when an alert_updated message is received", async () => {
    const onAlertUpdated = vi.fn();
    renderHook(() => useWebSocket({ onAlertUpdated }));

    await act(async () => { vi.runAllTimers(); });

    const es = MockEventSource.instances[0];
    const updatedAlert: Partial<Alert> = { id: "alert-1", status: "acknowledged" };

    act(() => {
      es.simulateMessage({ type: "alert_updated", data: updatedAlert });
    });

    expect(onAlertUpdated).toHaveBeenCalledWith(updatedAlert);
  });

  it("sets isConnected=false on error", async () => {
    const { result } = renderHook(() => useWebSocket({}));

    await act(async () => { vi.runAllTimers(); });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      MockEventSource.instances[0].simulateError();
    });

    expect(result.current.isConnected).toBe(false);
  });

  it("ignores malformed JSON messages without throwing", async () => {
    renderHook(() => useWebSocket({}));

    await act(async () => { vi.runAllTimers(); });

    const es = MockEventSource.instances[0];

    expect(() => {
      act(() => {
        const event = new MessageEvent("message", { data: "not-valid-json{{" });
        es.onmessage?.(event);
      });
    }).not.toThrow();
  });

  it("subscribes to all required Mercure topics in the URL", async () => {
    renderHook(() => useWebSocket({}));
    await act(async () => { vi.runAllTimers(); });

    const url = MockEventSource.instances[0].url;
    expect(url).toContain("topic=traffic%2Fevents");
    expect(url).toContain("topic=alerts%2Fnew");
    expect(url).toContain("topic=alerts%2Fupdated");
  });

  it("closes the EventSource on unmount", async () => {
    const { unmount } = renderHook(() => useWebSocket({}));
    await act(async () => { vi.runAllTimers(); });

    const es = MockEventSource.instances[0];
    expect(es.closed).toBe(false);

    unmount();
    expect(es.closed).toBe(true);
  });
});
