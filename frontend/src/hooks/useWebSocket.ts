import { useEffect, useRef, useState } from "react";
import type { NetworkEvent, Alert } from "../types";

interface MercureHandlers {
  onTrafficEvent?: (event: NetworkEvent) => void;
  onNewAlert?: (alert: Alert) => void;
  onAlertUpdated?: (alert: Alert) => void;
}

const MERCURE_URL = "http://localhost:3000/.well-known/mercure";
const TOPICS = ["traffic/events", "alerts/new", "alerts/updated"];

export function useWebSocket(handlers: MercureHandlers): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(false);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const url = new URL(MERCURE_URL);
    TOPICS.forEach((topic) => url.searchParams.append("topic", topic));

    const es = new EventSource(url.toString());

    es.onopen = () => setIsConnected(true);

    es.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, data } = message;

        if (type === "traffic_event") {
          handlersRef.current.onTrafficEvent?.(data as NetworkEvent);
        } else if (type === "new_alert") {
          handlersRef.current.onNewAlert?.(data as Alert);
        } else if (type === "alert_updated") {
          handlersRef.current.onAlertUpdated?.(data as Alert);
        }
      } catch {
        // ignore malformed messages
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      // EventSource reconnects automatically
    };

    return () => {
      es.close();
    };
  }, []);

  return { isConnected };
}
