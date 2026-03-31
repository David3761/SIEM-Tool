import React from "react";
import { Search, SlidersHorizontal } from "lucide-react";

export interface AlertFilterState {
  search: string;
  severity: string;
  status: string;
  sort_by: string;
  sort_dir: "asc" | "desc";
}

interface AlertFiltersProps {
  filters: AlertFilterState;
  onChange: (filters: AlertFilterState) => void;
}

export const AlertFilters: React.FC<AlertFiltersProps> = ({ filters, onChange }) => {
  const update = (partial: Partial<AlertFilterState>) =>
    onChange({ ...filters, ...partial });

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search alerts…"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className="bg-slate-800 border border-slate-700 rounded-md pl-9 pr-3 py-1.5 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 w-52"
        />
      </div>

      <select
        value={filters.severity}
        onChange={(e) => update({ severity: e.target.value })}
        className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50"
      >
        <option value="">All Severities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>

      <select
        value={filters.status}
        onChange={(e) => update({ status: e.target.value })}
        className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50"
      >
        <option value="">All Statuses</option>
        <option value="open">Open</option>
        <option value="acknowledged">Acknowledged</option>
        <option value="false_positive">False Positive</option>
        <option value="resolved">Resolved</option>
      </select>

      <div className="flex items-center gap-2 ml-auto">
        <SlidersHorizontal size={14} className="text-slate-500" />
        <select
          value={filters.sort_by}
          onChange={(e) => update({ sort_by: e.target.value })}
          className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50"
        >
          <option value="timestamp">Time</option>
          <option value="severity">Severity</option>
          <option value="status">Status</option>
        </select>
        <button
          onClick={() => update({ sort_dir: filters.sort_dir === "asc" ? "desc" : "asc" })}
          className="bg-slate-800 border border-slate-700 rounded-md px-2 py-1.5 text-sm font-mono text-slate-400 hover:text-slate-100 hover:border-slate-600 transition-colors"
        >
          {filters.sort_dir === "desc" ? "↓" : "↑"}
        </button>
      </div>
    </div>
  );
};
