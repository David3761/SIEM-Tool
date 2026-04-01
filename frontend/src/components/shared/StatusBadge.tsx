import React from "react";

interface StatusBadgeProps {
  status: "open" | "acknowledged" | "false_positive" | "resolved";
  className?: string;
}

const statusConfig = {
  open: { label: "Open", className: "text-red-400" },
  acknowledged: { label: "Acknowledged", className: "text-orange-400" },
  false_positive: { label: "False Positive", className: "text-slate-400" },
  resolved: { label: "Resolved", className: "text-green-400" },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = "" }) => {
  const config = statusConfig[status];
  return (
    <span className={`text-xs font-mono font-medium ${config.className} ${className}`}>
      {config.label}
    </span>
  );
};
