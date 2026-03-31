import React from "react";
import type { NetworkEvent } from "../../types";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from "lucide-react";

interface LiveTrafficFeedProps {
  events: NetworkEvent[];
}

const directionIcon = {
  inbound: <ArrowDownLeft size={12} className="text-blue-400" />,
  outbound: <ArrowUpRight size={12} className="text-orange-400" />,
  internal: <ArrowLeftRight size={12} className="text-slate-400" />,
};

const protocolColor = {
  TCP: "text-cyan-400",
  UDP: "text-purple-400",
  ICMP: "text-yellow-400",
  OTHER: "text-slate-400",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export const LiveTrafficFeed: React.FC<LiveTrafficFeedProps> = ({ events }) => {
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
        <h3 className="text-sm font-mono font-semibold text-slate-100">Live Traffic</h3>
        <span className="text-xs font-mono text-slate-500">{events.length} events</span>
      </div>
      <div className="overflow-auto max-h-80 font-mono text-xs">
        {events.length === 0 ? (
          <div className="text-slate-500 text-center py-8">Waiting for traffic…</div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-3 px-4 py-1.5 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
            >
              <span className="text-slate-600 w-20 shrink-0">{formatTime(event.timestamp)}</span>
              <span className="shrink-0">{directionIcon[event.direction]}</span>
              <span className={`w-10 shrink-0 ${protocolColor[event.protocol]}`}>
                {event.protocol}
              </span>
              <span className="text-slate-300 truncate flex-1">
                {event.src_ip}
                {event.src_port ? `:${event.src_port}` : ""}{" "}
                <span className="text-slate-600">→</span>{" "}
                {event.dst_ip}
                {event.dst_port ? `:${event.dst_port}` : ""}
              </span>
              <span className="text-slate-500 shrink-0">{formatBytes(event.bytes_sent)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
