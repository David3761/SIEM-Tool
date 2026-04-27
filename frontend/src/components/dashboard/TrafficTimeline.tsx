import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { StatsResponse } from "../../types";

interface TrafficTimelineProps {
  stats: StatsResponse;
}

// Build a simple timeline from direction counts
export const TrafficTimeline: React.FC<TrafficTimelineProps> = ({ stats }) => {
  const data = [
    { name: "Inbound", value: stats.inbound_count, fill: "#22d3ee" },
    { name: "Outbound", value: stats.outbound_count, fill: "#fb923c" },
    { name: "Internal", value: stats.internal_count, fill: "#a78bfa" },
  ];


  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-mono font-semibold text-slate-100 mb-1">Traffic Direction</h3>
      <p className="text-xs font-mono text-slate-500 mb-4">Last {stats.time_range}</p>
      <div className="flex gap-6">
        {data.map((d) => (
          <div key={d.name} className="flex-1 text-center">
            <p className="text-xs font-mono text-slate-500 mb-1">{d.name}</p>
            <p className="text-lg font-mono font-bold" style={{ color: d.fill }}>
              {d.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <ResponsiveContainer width="100%" height={80}>
          <AreaChart
            data={[
              { name: "Inbound", value: stats.inbound_count },
              { name: "Outbound", value: stats.outbound_count },
              { name: "Internal", value: stats.internal_count },
            ]}
          >
            <XAxis
              dataKey="name"
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: 6,
                fontSize: 12,
                fontFamily: "monospace",
                color: "#e2e8f0",
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#22d3ee"
              fill="rgba(34,211,238,0.1)"
              strokeWidth={1.5}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
