import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import type { StatsResponse } from "../../types";

interface TrafficTimelineProps {
  stats: StatsResponse;
}

const DIRECTIONS = [
  { key: "inbound",  label: "Inbound",  color: "#22d3ee", icon: ArrowDown, hint: "From external → internal" },
  { key: "outbound", label: "Outbound", color: "#fb923c", icon: ArrowUp,   hint: "From internal → external" },
  { key: "internal", label: "Internal", color: "#a78bfa", icon: RefreshCw, hint: "Internal ↔ internal" },
] as const;

export const TrafficTimeline: React.FC<TrafficTimelineProps> = ({ stats }) => {
  const data = DIRECTIONS.map((d) => ({
    name: d.label,
    value: (stats[`${d.key}_count` as keyof StatsResponse] as number) ?? 0,
    fill: d.color,
  }));

  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-mono font-semibold text-slate-100 mb-1">Traffic Direction</h3>
      <p className="text-xs font-mono text-slate-500 mb-4">Last {stats.time_range ?? "1h"}</p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {DIRECTIONS.map((d) => {
          const value = (stats[`${d.key}_count` as keyof StatsResponse] as number) ?? 0;
          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
          const Icon = d.icon;
          return (
            <div
              key={d.key}
              className="bg-slate-900/50 border border-slate-700/50 rounded-md p-3"
              title={d.hint}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon size={11} style={{ color: d.color }} />
                <p className="text-xs font-mono text-slate-400">{d.label}</p>
              </div>
              <p className="text-lg font-mono font-bold" style={{ color: d.color }}>
                {value.toLocaleString()}
              </p>
              <p className="text-xs font-mono text-slate-600 mt-0.5">{pct}%</p>
            </div>
          );
        })}
      </div>

      {/* Bar chart — proper categorical comparison */}
      <ResponsiveContainer width="100%" height={110}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={70}
            tick={{ fill: "#94a3b8", fontSize: 10, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: "monospace",
            }}
            labelStyle={{ color: "#e2e8f0" }}
            itemStyle={{ color: "#e2e8f0" }}
            cursor={{ fill: "rgba(148,163,184,0.05)" }}
            formatter={(value) => [(value as number).toLocaleString(), "Events"]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
