import React from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, RefreshCw } from "lucide-react";
import { getIncident, updateIncident, regenerateRemediation } from "../api/incidents";
import type { AIRemediation } from "../types";
import { SeverityBadge } from "../components/shared/SeverityBadge";
import { IncidentTimeline } from "../components/incidents/IncidentTimeline";
import { RemediationPanel } from "../components/incidents/RemediationPanel";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import toast from "react-hot-toast";

const STATUS_OPTIONS = ["open", "in_progress", "resolved"] as const;

// Maps old agent output field names to the current AIRemediation interface.
// Preserves the `error` field so RemediationPanel can show the error UI.
function normalizeRemediation(raw: Record<string, unknown>): AIRemediation & { error?: string } {
  const toArray = (v: unknown, fallback: unknown): string[] => {
    if (Array.isArray(v)) return v as string[];
    if (typeof v === "string" && v) return [v];
    if (Array.isArray(fallback)) return fallback as string[];
    return [];
  };

  const normalized: AIRemediation & { error?: string } = {
    summary: (raw.summary || raw.executive_summary || "") as string,
    attack_pattern: (raw.attack_pattern || raw.root_cause || "") as string,
    mitre_tactics: toArray(raw.mitre_tactics, raw.mitre_tactic ? [raw.mitre_tactic] : []),
    mitre_techniques: toArray(raw.mitre_techniques, raw.mitre_technique ? [raw.mitre_technique] : []),
    remediation_steps: toArray(raw.remediation_steps, []),
    iocs: toArray(raw.iocs, raw.affected_assets ?? []),
    timeline: Array.isArray(raw.timeline) ? raw.timeline as AIRemediation["timeline"] : [],
    analyzed_at: (raw.analyzed_at || "") as string,
  };

  if (typeof raw.error === "string" && raw.error) {
    normalized.error = raw.error;
  }
  return normalized;
}

export const IncidentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: incident, isLoading } = useQuery({
    queryKey: ["incident", id],
    queryFn: () => getIncident(id!),
    enabled: !!id,
    refetchInterval: (query) =>
      !query.state.data?.ai_remediation ? 3000 : false,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      updateIncident(id!, { status: status as "open" | "in_progress" | "resolved" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incident", id] });
      toast.success("Status updated");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const regenerateMutation = useMutation({
    mutationFn: () => regenerateRemediation(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incident", id] });
      toast.success("Regenerating plan — Agent 2 will pick this up shortly");
    },
    onError: () => toast.error("Failed to reset remediation"),
  });

  if (isLoading || !incident) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const remediation = incident.ai_remediation
    ? normalizeRemediation(incident.ai_remediation as unknown as Record<string, unknown>)
    : null;

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
          <RemediationPanel remediation={remediation} />

          {/* Regenerate button — shown when plan exists but looks empty, or on demand */}
          {incident.ai_remediation && (
            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <button
                onClick={() => regenerateMutation.mutate()}
                disabled={regenerateMutation.isPending}
                className="flex items-center gap-2 text-xs font-mono text-slate-600 hover:text-slate-400 disabled:opacity-50 transition-colors"
              >
                {regenerateMutation.isPending
                  ? <LoadingSpinner size="sm" />
                  : <RefreshCw size={11} />}
                Regenerate plan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
