import React from "react";
import { useQuery } from "@tanstack/react-query";
import { X, ExternalLink } from "lucide-react";
import { getAlert } from "../../api/alerts";
import { SeverityBadge } from "../shared/SeverityBadge";
import { StatusBadge } from "../shared/StatusBadge";
import { AIAnalysisPanel } from "./AIAnalysisPanel";
import { LoadingSpinner } from "../shared/LoadingSpinner";

interface AlertDetailProps {
  alertId: string;
  onClose: () => void;
}

export const AlertDetail: React.FC<AlertDetailProps> = ({ alertId, onClose }) => {
  const { data: alert, isLoading } = useQuery({
    queryKey: ["alert", alertId],
    queryFn: () => getAlert(alertId),
    refetchInterval: (query) =>
      query.state.data?.ai_analysis === null ? 3000 : false,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl h-full bg-slate-900 border-l border-slate-700 flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <h2 className="text-sm font-mono font-semibold text-slate-100">Alert Detail</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {isLoading || !alert ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-5 space-y-6">
            {/* Alert summary */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-mono font-bold text-slate-100 leading-tight">
                  {alert.rule_name}
                </h3>
                <SeverityBadge severity={alert.severity} />
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={alert.status} />
                <span className="text-xs font-mono text-slate-600">•</span>
                <span className="text-xs font-mono text-slate-500">
                  {new Date(alert.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Triggering event */}
            <div>
              <p className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Triggering Event
              </p>
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 font-mono text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Source</span>
                  <span className="text-slate-200">
                    {alert.triggering_event.src_ip}
                    {alert.triggering_event.src_port
                      ? `:${alert.triggering_event.src_port}`
                      : ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Destination</span>
                  <span className="text-slate-200">
                    {alert.triggering_event.dst_ip}
                    {alert.triggering_event.dst_port
                      ? `:${alert.triggering_event.dst_port}`
                      : ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Protocol</span>
                  <span className="text-cyan-400">{alert.triggering_event.protocol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Direction</span>
                  <span className="text-slate-300">{alert.triggering_event.direction}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Bytes</span>
                  <span className="text-slate-300">
                    {alert.triggering_event.bytes_sent.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Related events */}
            {alert.related_event_ids.length > 0 && (
              <div>
                <p className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Related Events ({alert.related_event_ids.length})
                </p>
                <div className="flex flex-wrap gap-1">
                  {alert.related_event_ids.slice(0, 8).map((id) => (
                    <code key={id} className="text-xs font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
                      {id.slice(0, 8)}…
                    </code>
                  ))}
                </div>
              </div>
            )}

            {/* AI Analysis */}
            <div>
              <p className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider mb-3">
                AI Analysis
              </p>
              <AIAnalysisPanel analysis={alert.ai_analysis} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
