import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { getAlerts, exportAlerts } from "../api/alerts";
import type { Alert } from "../types";
import { useWebSocket } from "../hooks/useWebSocket";
import { AlertsTable } from "../components/alerts/AlertsTable";
import { AlertFilters, type AlertFilterState } from "../components/alerts/AlertFilters";
import { AlertDetail } from "../components/alerts/AlertDetail";
import { Pagination } from "../components/shared/Pagination";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import toast from "react-hot-toast";

const DEFAULT_FILTERS: AlertFilterState = {
  search: "",
  severity: "",
  status: "",
  sort_by: "timestamp",
  sort_dir: "desc",
};

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export const Alerts: React.FC = () => {
  const [filters, setFilters] = useState<AlertFilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const queryClient = useQueryClient();

  const debouncedFilters = useDebounce(filters, 400);

  const queryParams = {
    page,
    limit: 20,
    ...(debouncedFilters.search && { search: debouncedFilters.search }),
    ...(debouncedFilters.severity && { severity: debouncedFilters.severity }),
    ...(debouncedFilters.status && { status: debouncedFilters.status }),
    sort_by: debouncedFilters.sort_by,
    sort_dir: debouncedFilters.sort_dir,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["alerts", queryParams],
    queryFn: () => getAlerts(queryParams),
  });

  const onNewAlert = useCallback(
    (alert: Alert) => {
      toast.error(`New alert: ${alert.rule_name} — ${alert.severity.toUpperCase()}`, {
        duration: 5000,
      });
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    [queryClient]
  );

  const onAlertUpdated = useCallback(
    (_alert: Alert) => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    [queryClient]
  );

  useWebSocket({ onNewAlert, onAlertUpdated });

  const handleExport = async (format: "csv" | "pdf") => {
    const setter = format === "csv" ? setExportingCsv : setExportingPdf;
    setter(true);
    try {
      const blob = await exportAlerts(format, queryParams);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `alerts.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(`Failed to export ${format.toUpperCase()}`);
    } finally {
      setter(false);
    }
  };

  const handleFilterChange = (newFilters: AlertFilterState) => {
    setFilters(newFilters);
    setPage(1);
  };

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <AlertFilters filters={filters} onChange={handleFilterChange} />
        <div className="flex gap-2">
          <button
            onClick={() => handleExport("csv")}
            disabled={exportingCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 hover:text-slate-100 hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {exportingCsv ? <LoadingSpinner size="sm" /> : <Download size={12} />}
            CSV
          </button>
          <button
            onClick={() => handleExport("pdf")}
            disabled={exportingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 hover:text-slate-100 hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {exportingPdf ? <LoadingSpinner size="sm" /> : <FileText size={12} />}
            PDF
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            <AlertsTable alerts={data?.items ?? []} onSelect={setSelectedAlertId} />
            {data && data.pages > 1 && (
              <Pagination
                page={data.page}
                pages={data.pages}
                total={data.total}
                limit={data.limit}
                onPageChange={setPage}
              />
            )}
          </>
        )}
      </div>

      {/* Detail panel */}
      {selectedAlertId && (
        <AlertDetail alertId={selectedAlertId} onClose={() => setSelectedAlertId(null)} />
      )}
    </div>
  );
};
