import { useEffect, useRef, useState, useCallback } from "react";
import type { NetworkEvent, Alert } from "../types";

interface WebSocketHandlers {
  onTrafficEvent?: (event: NetworkEvent) => void;
  onNewAlert?: (alert: Alert) => void;
  onAlertUpdated?: (alert: Alert) => void;
}

const WS_URL = "ws://localhost:8080";
const MAX_BACKOFF = 30000;

export function useWebSocket(handlers: WebSocketHandlers): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(1000);
  const handlersRef = useRef(handlers);

  // Keep handlers ref up to date without triggering reconnect
  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) return;

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        backoffRef.current = 1000; // reset backoff on successful connect
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { type, data } = message;

          if (type === "traffic_event" && handlersRef.current.onTrafficEvent) {
            handlersRef.current.onTrafficEvent(data as NetworkEvent);
          } else if (type === "new_alert" && handlersRef.current.onNewAlert) {
            handlersRef.current.onNewAlert(data as Alert);
          } else if (type === "alert_updated" && handlersRef.current.onAlertUpdated) {
            handlersRef.current.onAlertUpdated(data as Alert);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        const delay = Math.min(backoffRef.current, MAX_BACKOFF);
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      const delay = Math.min(backoffRef.current, MAX_BACKOFF);
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF);
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on unmount
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected };
}
