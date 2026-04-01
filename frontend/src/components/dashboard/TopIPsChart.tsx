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
import type { StatsResponse } from "../../types";

interface TopIPsChartProps {
  data: StatsResponse["top_source_ips"];
}

export const TopIPsChart: React.FC<TopIPsChartProps> = ({ data }) => {
  const chartData = data.slice(0, 8).map((d) => ({
    ip: d.ip,
    events: d.event_count,
  }));

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-mono font-semibold text-slate-100 mb-4">Top Source IPs</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 16 }}>
          <XAxis
            type="number"
            tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="ip"
            width={110}
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
              color: "#e2e8f0",
            }}
            cursor={{ fill: "rgba(148,163,184,0.05)" }}
            formatter={(value) => [value, "Events"]}
          />
          <Bar dataKey="events" radius={[0, 4, 4, 0]}>
            {chartData.map((_, index) => (
              <Cell
                key={index}
                fill={index === 0 ? "#22d3ee" : `rgba(34,211,238,${0.6 - index * 0.07})`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
