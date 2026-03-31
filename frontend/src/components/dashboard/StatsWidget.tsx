import React from "react";
import type { LucideIcon } from "lucide-react";

interface StatsWidgetProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  sub?: string;
  accent?: "cyan" | "red" | "orange" | "green";
}

const accentMap = {
  cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  red: "text-red-400 bg-red-500/10 border-red-500/20",
  orange: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  green: "text-green-400 bg-green-500/10 border-green-500/20",
};

export const StatsWidget: React.FC<StatsWidgetProps> = ({
  label,
  value,
  icon: Icon,
  sub,
  accent = "cyan",
}) => {
  const accentClass = accentMap[accent];
  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${accentClass}`}>
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs font-mono text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-xl font-mono font-bold text-slate-100">{value}</p>
        {sub && <p className="text-xs font-mono text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
};
