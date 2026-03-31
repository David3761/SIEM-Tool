import React from "react";
import type { Alert } from "../../types";
import { SeverityBadge } from "../shared/SeverityBadge";
import { StatusBadge } from "../shared/StatusBadge";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { CheckCircle2, XCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateAlertStatus } from "../../api/alerts";
import toast from "react-hot-toast";

interface AlertRowProps {
  alert: Alert;
  onSelect: (id: string) => void;
}

export const AlertRow: React.FC<AlertRowProps> = ({ alert, onSelect }) => {
  const queryClient = useQueryClient();

  const fpMutation = useMutation({
    mutationFn: () => updateAlertStatus(alert.id, "false_positive"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Marked as false positive");
    },
    onError: () => toast.error("Failed to update alert"),
  });

  return (
    <tr
      className="border-b border-slate-700/50 hover:bg-slate-700/20 cursor-pointer transition-colors group"
      onClick={() => onSelect(alert.id)}
    >
      <td className="px-4 py-3">
        <SeverityBadge severity={alert.severity} />
      </td>
      <td className="px-4 py-3">
        <span className="text-sm font-mono text-slate-200">{alert.rule_name}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs font-mono text-slate-400">
          {alert.triggering_event.src_ip} → {alert.triggering_event.dst_ip}
        </span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={alert.status} />
      </td>
      <td className="px-4 py-3">
        {alert.ai_analysis === null ? (
          <div className="flex items-center gap-1.5 text-slate-500">
            <LoadingSpinner size="sm" />
            <span className="text-xs font-mono">Analyzing…</span>
          </div>
        ) : alert.ai_analysis.error ? (
          <span className="text-xs font-mono text-yellow-500">Error</span>
        ) : (
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={13} className="text-green-400" />
            <span className="text-xs font-mono text-slate-400">
              {alert.ai_analysis.confidence}% conf.
            </span>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-xs font-mono text-slate-500">
        {new Date(alert.timestamp).toLocaleString()}
      </td>
      <td
        className="px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        {alert.status !== "false_positive" && (
          <button
            onClick={() => fpMutation.mutate()}
            disabled={fpMutation.isPending}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono text-slate-400 hover:text-red-400 hover:bg-red-900/20 border border-transparent hover:border-red-800/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            title="Mark as False Positive"
          >
            {fpMutation.isPending ? (
              <LoadingSpinner size="sm" />
            ) : (
              <XCircle size={12} />
            )}
            FP
          </button>
        )}
      </td>
    </tr>
  );
};
