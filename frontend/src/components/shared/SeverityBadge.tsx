import React from "react";

interface SeverityBadgeProps {
  severity: "low" | "medium" | "high" | "critical";
  className?: string;
}

const severityConfig = {
  critical: {
    label: "Critical",
    className: "text-red-400 bg-red-900/50 border border-red-800",
  },
  high: {
    label: "High",
    className: "text-orange-400 bg-orange-900/50 border border-orange-800",
  },
  medium: {
    label: "Medium",
    className: "text-yellow-400 bg-yellow-900/50 border border-yellow-800",
  },
  low: {
    label: "Low",
    className: "text-blue-400 bg-blue-900/50 border border-blue-800",
  },
};

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity, className = "" }) => {
  const config = severityConfig[severity];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold uppercase tracking-wider ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
};
