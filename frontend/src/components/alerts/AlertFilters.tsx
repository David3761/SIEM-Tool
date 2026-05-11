import React from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getRules } from "../../api/rules";

export interface AlertFilterState {
  search: string;
  severity: string;
  status: string;
  rule_id: string;
  from: string;
  to: string;
  sort_by: string;
  sort_dir: "asc" | "desc";
}

export const DEFAULT_ALERT_FILTERS: AlertFilterState = {
  search: "",
  severity: "",
  status: "",
  rule_id: "",
  from: "",
  to: "",
  sort_by: "timestamp",
  sort_dir: "desc",
};

interface AlertFiltersProps {
  filters: AlertFilterState;
  onChange: (filters: AlertFilterState) => void;
}

const TIME_RANGES = [
  { label: "1h", hours: 1 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
];

function getFromIso(hours: number): string {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

function activeRangeLabel(from: string): string | null {
  for (const r of TIME_RANGES) {
    const expected = getFromIso(r.hours);
    const diff = Math.abs(new Date(from).getTime() - new Date(expected).getTime());
    if (diff < 60_000) return r.label;
  }
  return null;
}

export const AlertFilters: React.FC<AlertFiltersProps> = ({ filters, onChange }) => {
  const update = (partial: Partial<AlertFilterState>) =>
    onChange({ ...filters, ...partial });

  const { data: rules } = useQuery({
    queryKey: ["rules"],
    queryFn: getRules,
    staleTime: 60_000,
  });

  const hasActiveFilters =
    filters.search ||
    filters.severity ||
    filters.status ||
    filters.rule_id ||
    filters.from ||
    filters.to;

  const activeRange = filters.from ? activeRangeLabel(filters.from) : null;

  const selectRange = (hours: number, label: string) => {
    if (activeRange === label) {
      update({ from: "", to: "" });
    } else {
      update({ from: getFromIso(hours), to: "" });
    }
  };

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search rule name…"
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className="bg-slate-800 border border-slate-700 rounded-md pl-9 pr-3 py-1.5 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 w-48"
        />
      </div>

      {/* Severity */}
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

      {/* Status */}
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

      {/* Rule */}
      {rules && rules.length > 0 && (
        <select
          value={filters.rule_id}
          onChange={(e) => update({ rule_id: e.target.value })}
          className="bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50 max-w-[200px]"
        >
          <option value="">All Rules</option>
          {rules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      )}

      {/* Time range */}
      <div className="flex items-center gap-1">
        {TIME_RANGES.map((r) => (
          <button
            key={r.label}
            onClick={() => selectRange(r.hours, r.label)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-mono border transition-colors ${
              activeRange === r.label
                ? "bg-cyan-900/40 border-cyan-500/60 text-cyan-300"
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Sort */}
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

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            onClick={() => onChange(DEFAULT_ALERT_FILTERS)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-mono text-slate-500 hover:text-red-400 hover:border-red-900/50 transition-colors"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
