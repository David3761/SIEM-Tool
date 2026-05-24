import React from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { StatsResponse } from "../../types";

interface ProtocolPieChartProps {
  data: StatsResponse["protocol_breakdown"];
}

const COLORS: Record<string, string> = {
  TCP:   "#22d3ee", // cyan-400
  UDP:   "#c084fc", // purple-400
  ICMP:  "#facc15", // yellow-400
  OTHER: "#94a3b8", // slate-400
};

export const ProtocolPieChart: React.FC<ProtocolPieChartProps> = ({ data }) => {
  const chartData = Object.entries(data).map(([name, value]) => ({ name, value }));

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-sm font-mono font-semibold text-slate-100 mb-4">Protocol Breakdown</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={COLORS[entry.name] ?? "#94a3b8"}
                stroke="#1e293b"
                strokeWidth={2}
              />
            ))}
          </Pie>
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
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ color: "#94a3b8", fontSize: 11, fontFamily: "monospace" }}>
                {value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
