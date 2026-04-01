import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getIncidents } from "../api/incidents";
import { SeverityBadge } from "../components/shared/SeverityBadge";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { FolderOpen, ChevronRight } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  open: "text-red-400",
  in_progress: "text-orange-400",
  resolved: "text-green-400",
};

export const Incidents: React.FC = () => {
  const { data: incidents, isLoading } = useQuery({
    queryKey: ["incidents"],
    queryFn: getIncidents,
  });

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        {!incidents || incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-600">
            <FolderOpen size={32} className="mb-3 opacity-50" />
            <p className="font-mono text-sm">No incidents recorded</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                {["Severity", "Title", "Status", "Alerts", "Created", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr
                  key={incident.id}
                  className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <SeverityBadge severity={incident.severity} />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-mono text-slate-200">{incident.title}</p>
                    {incident.description && (
                      <p className="text-xs font-mono text-slate-500 mt-0.5 truncate max-w-xs">
                        {incident.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-mono font-medium ${STATUS_COLORS[incident.status] ?? "text-slate-400"}`}
                    >
                      {incident.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-slate-400">
                    {incident.alert_ids.length}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-500">
                    {new Date(incident.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/incidents/${incident.id}`}
                      className="flex items-center gap-1 text-xs font-mono text-slate-400 hover:text-cyan-400 transition-colors"
                    >
                      View <ChevronRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
