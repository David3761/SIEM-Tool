import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Database, Zap, Bell } from "lucide-react";
import { getStats } from "../api/stats";
import { getAlerts } from "../api/alerts";
import type { NetworkEvent, Alert } from "../types";
import { useWebSocket } from "../hooks/useWebSocket";
import { LiveTrafficFeed } from "../components/dashboard/LiveTrafficFeed";
import { StatsWidget } from "../components/dashboard/StatsWidget";
import { TopIPsChart } from "../components/dashboard/TopIPsChart";
import { ProtocolPieChart } from "../components/dashboard/ProtocolPieChart";
import { TrafficTimeline } from "../components/dashboard/TrafficTimeline";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import toast from "react-hot-toast";

const MAX_FEED_SIZE = 100;

interface DashboardProps {
  onWsConnect: (connected: boolean) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onWsConnect }) => {
  const [liveEvents, setLiveEvents] = useState<NetworkEvent[]>([]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["stats", "1h"],
    queryFn: () => getStats("1h"),
    refetchInterval: 30_000,
  });

  const { data: alertsData } = useQuery({
    queryKey: ["alerts", { status: "open" }],
    queryFn: () => getAlerts({ status: "open", limit: 1 }),
  });

  const onTrafficEvent = useCallback((event: NetworkEvent) => {
    setLiveEvents((prev) => [event, ...prev].slice(0, MAX_FEED_SIZE));
  }, []);

  const onNewAlert = useCallback((alert: Alert) => {
    toast.error(`New alert: ${alert.rule_name} — ${alert.severity.toUpperCase()}`, {
      duration: 5000,
    });
  }, []);

  const { isConnected } = useWebSocket({ onTrafficEvent, onNewAlert });

  React.useEffect(() => {
    onWsConnect(isConnected);
  }, [isConnected, onWsConnect]);

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Stat widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsWidget
          label="Total Events"
          value={(stats?.total_events ?? 0).toLocaleString()}
          icon={Activity}
          sub="Last hour"
          accent="cyan"
        />
        <StatsWidget
          label="Total Bytes"
          value={
            stats
              ? stats.total_bytes >= 1024 * 1024
                ? `${(stats.total_bytes / 1024 / 1024).toFixed(1)} MB`
                : `${(stats.total_bytes / 1024).toFixed(1)} KB`
              : "—"
          }
          icon={Database}
          accent="cyan"
        />
        <StatsWidget
          label="Events / Min"
          value={(stats?.events_per_minute ?? 0).toFixed(1)}
          icon={Zap}
          accent="orange"
        />
        <StatsWidget
          label="Open Alerts"
          value={alertsData?.total ?? 0}
          icon={Bell}
          accent="red"
        />
      </div>

      {/* Charts row */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <TopIPsChart data={stats.top_source_ips} />
          </div>
          <ProtocolPieChart data={stats.protocol_breakdown} />
        </div>
      )}

      {/* Timeline + live feed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {stats && <TrafficTimeline stats={stats} />}
        <LiveTrafficFeed events={liveEvents} />
      </div>
    </div>
  );
};
