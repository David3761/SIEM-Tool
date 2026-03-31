import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { getIncident, updateIncident } from "../api/incidents";
import { SeverityBadge } from "../components/shared/SeverityBadge";
import { IncidentTimeline } from "../components/incidents/IncidentTimeline";
import { RemediationPanel } from "../components/incidents/RemediationPanel";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import toast from "react-hot-toast";

const STATUS_OPTIONS = ["open", "in_progress", "resolved"] as const;

export const IncidentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: incident, isLoading } = useQuery({
    queryKey: ["incident", id],
    queryFn: () => getIncident(id!),
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data?.ai_remediation === null ? 5000 : false,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => updateIncident(id!, { status: status as "open" | "in_progress" | "resolved" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incident", id] });
      toast.success("Status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  if (isLoading || !incident) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Back */}
      <Link
        to="/incidents"
        className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-500 hover:text-slate-300 transition-colors"
      >
        <ChevronLeft size={13} /> Back to Incidents
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <SeverityBadge severity={incident.severity} />
            <h2 className="text-lg font-mono font-bold text-slate-100">{incident.title}</h2>
          </div>
          {incident.description && (
            <p className="text-sm font-mono text-slate-400">{incident.description}</p>
          )}
          <p className="text-xs font-mono text-slate-600 mt-1">
            Created {new Date(incident.created_at).toLocaleString()}
            {incident.updated_at && ` · Updated ${new Date(incident.updated_at).toLocaleString()}`}
          </p>
        </div>
        <select
          value={incident.status}
          onChange={(e) => statusMutation.mutate(e.target.value)}
          disabled={statusMutation.isPending}
          className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50 disabled:opacity-50"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <h3 className="text-sm font-mono font-semibold text-slate-100 mb-5">
            Incident Timeline
          </h3>
          <IncidentTimeline timeline={incident.timeline ?? []} />
        </div>

        {/* Remediation */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-5">
          <h3 className="text-sm font-mono font-semibold text-slate-100 mb-5">
            AI Remediation Plan
          </h3>
          <RemediationPanel remediation={incident.ai_remediation} />
        </div>
      </div>
    </div>
  );
};
