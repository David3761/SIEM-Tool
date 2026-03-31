import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWebSocket } from "../hooks/useWebSocket";
import type { NetworkEvent, Alert } from "../types";

// Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = [];

  readyState: number = WebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
    // Simulate async connection
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.();
    }, 0);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    const event = new CloseEvent("close");
    this.onclose?.(event);
  }

  simulateMessage(data: object) {
    const event = new MessageEvent("message", { data: JSON.stringify(data) });
    this.onmessage?.(event);
  }

  simulateClose() {
    this.close();
  }

  send(_data: string) {}
}

let originalWebSocket: typeof WebSocket;

beforeEach(() => {
  MockWebSocket.instances = [];
  originalWebSocket = global.WebSocket;
  (global as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket as unknown as typeof WebSocket;
  vi.useFakeTimers();
});

afterEach(() => {
  global.WebSocket = originalWebSocket;
  vi.useRealTimers();
  vi.clearAllTimers();
});

describe("useWebSocket", () => {
  it("returns isConnected=false initially and true after connection opens", async () => {
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

    await act(async () => {
      vi.runAllTimers();
    });

    const ws = MockWebSocket.instances[0];
    const mockEvent: Partial<NetworkEvent> = {
      id: "evt-1",
      src_ip: "1.2.3.4",
      dst_ip: "5.6.7.8",
      protocol: "TCP",
    };

    act(() => {
      ws.simulateMessage({ type: "traffic_event", data: mockEvent });
    });

    expect(onTrafficEvent).toHaveBeenCalledWith(mockEvent);
  });

  it("calls onNewAlert when a new_alert message is received", async () => {
    const onNewAlert = vi.fn();
    renderHook(() => useWebSocket({ onNewAlert }));

    await act(async () => {
      vi.runAllTimers();
    });

    const ws = MockWebSocket.instances[0];
    const mockAlert: Partial<Alert> = {
      id: "alert-1",
      rule_name: "Port Scan",
      severity: "high",
    };

    act(() => {
      ws.simulateMessage({ type: "new_alert", data: mockAlert });
    });

    expect(onNewAlert).toHaveBeenCalledWith(mockAlert);
  });

  it("calls onAlertUpdated when an alert_updated message is received", async () => {
    const onAlertUpdated = vi.fn();
    renderHook(() => useWebSocket({ onAlertUpdated }));

    await act(async () => {
      vi.runAllTimers();
    });

    const ws = MockWebSocket.instances[0];
    const updatedAlert: Partial<Alert> = { id: "alert-1", status: "acknowledged" };

    act(() => {
      ws.simulateMessage({ type: "alert_updated", data: updatedAlert });
    });

    expect(onAlertUpdated).toHaveBeenCalledWith(updatedAlert);
  });

  it("sets isConnected=false after disconnect", async () => {
    const { result } = renderHook(() => useWebSocket({}));

    await act(async () => {
      vi.runAllTimers();
    });

    expect(result.current.isConnected).toBe(true);

    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.simulateClose();
    });

    expect(result.current.isConnected).toBe(false);
  });

  it("reconnects after disconnect with exponential backoff", async () => {
    renderHook(() => useWebSocket({}));

    await act(async () => {
      vi.runAllTimers();
    });

    expect(MockWebSocket.instances).toHaveLength(1);

    // Close the connection
    act(() => {
      MockWebSocket.instances[0].simulateClose();
    });

    // Fast-forward 1s (initial backoff)
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    // A new WebSocket connection should have been created
    expect(MockWebSocket.instances.length).toBeGreaterThan(1);
  });

  it("ignores malformed JSON messages without throwing", async () => {
    renderHook(() => useWebSocket({}));

    await act(async () => {
      vi.runAllTimers();
    });

    const ws = MockWebSocket.instances[0];

    expect(() => {
      act(() => {
        const event = new MessageEvent("message", { data: "not-valid-json{{" });
        ws.onmessage?.(event);
      });
    }).not.toThrow();
  });
});
