import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { getEvents, type EventsParams } from "../api/events";
import { useWebSocket } from "../hooks/useWebSocket";
import { Pagination } from "../components/shared/Pagination";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";
import { IpLabel } from "../components/shared/IpLabel";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface Filters {
  src_ip: string;
  dst_ip: string;
  protocol: string;
  direction: string;
  port: string;
  from: string;
  to: string;
}

const DEFAULT_FILTERS: Filters = {
  src_ip: "", dst_ip: "", protocol: "", direction: "", port: "", from: "", to: "",
};

const TIME_RANGES = [
  { label: "5m", minutes: 5 },
  { label: "15m", minutes: 15 },
  { label: "1h", minutes: 60 },
  { label: "6h", minutes: 360 },
];

function getFromIso(minutes: number): string {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString();
}

function activeRangeLabel(from: string): string | null {
  for (const r of TIME_RANGES) {
    const diff = Math.abs(new Date(from).getTime() - new Date(getFromIso(r.minutes)).getTime());
    if (diff < 60_000) return r.label;
  }
  return null;
}

const PROTOCOL_COLORS: Record<string, string> = {
  TCP: "text-cyan-400",
  UDP: "text-purple-400",
  ICMP: "text-yellow-400",
  OTHER: "text-slate-400",
};

const DIR_COLORS: Record<string, string> = {
  inbound: "text-blue-400",
  outbound: "text-orange-400",
  internal: "text-slate-400",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export const Events: React.FC = () => {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const debounced = useDebounce(filters, 400);

  const queryParams: EventsParams = {
    page,
    limit: 50,
    ...(debounced.src_ip && { src_ip: debounced.src_ip }),
    ...(debounced.dst_ip && { dst_ip: debounced.dst_ip }),
    ...(debounced.protocol && { protocol: debounced.protocol }),
    ...(debounced.direction && { direction: debounced.direction }),
    ...(debounced.port && { port: Number(debounced.port) }),
    ...(debounced.from && { from: debounced.from }),
    ...(debounced.to && { to: debounced.to }),
  };

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["events", queryParams],
    queryFn: () => getEvents(queryParams),
    refetchInterval: 5_000,
  });

  const onTrafficEvent = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["events"] });
  }, [queryClient]);

  useWebSocket({ onTrafficEvent });

  const update = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters((prev) => ({ ...prev, [key]: e.target.value }));
    setPage(1);
  };

  const setFrom = (minutes: number, label: string) => {
    const current = activeRangeLabel(filters.from);
    setFilters((prev) => ({ ...prev, from: current === label ? "" : getFromIso(minutes), to: "" }));
    setPage(1);
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  const inputClass =
    "bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50";

  const activeRange = filters.from ? activeRangeLabel(filters.from) : null;

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Source IP"
            value={filters.src_ip}
            onChange={update("src_ip")}
            className={`${inputClass} pl-8 w-40`}
          />
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Dest IP"
            value={filters.dst_ip}
            onChange={update("dst_ip")}
            className={`${inputClass} pl-8 w-40`}
          />
        </div>
        <input
          type="text"
          placeholder="Port (src or dst)"
          value={filters.port}
          onChange={update("port")}
          className={`${inputClass} w-36`}
        />
        <select value={filters.protocol} onChange={update("protocol")} className={inputClass}>
          <option value="">All Protocols</option>
          <option value="TCP">TCP</option>
          <option value="UDP">UDP</option>
          <option value="ICMP">ICMP</option>
          <option value="OTHER">Other</option>
        </select>
        <select value={filters.direction} onChange={update("direction")} className={inputClass}>
          <option value="">All Directions</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
          <option value="internal">Internal</option>
        </select>

        {/* Time range quick-select */}
        <div className="flex items-center gap-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setFrom(r.minutes, r.label)}
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

        {/* Clear all */}
        {hasActiveFilters && (
          <button
            onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-xs font-mono text-slate-500 hover:text-red-400 hover:border-red-900/50 transition-colors"
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-slate-800 rounded-lg border border-slate-700">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-700">
                    {["Time", "Protocol", "Source", "Destination", "Direction", "Bytes", "Flags"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {(data?.items ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-600">
                        No events match the current filters
                      </td>
                    </tr>
                  ) : (
                    (data?.items ?? []).map((event) => (
                      <tr
                        key={event.id}
                        className="border-b border-slate-700/50 hover:bg-slate-700/20 transition-colors"
                      >
                        <td className="px-4 py-2 text-slate-500">
                          {new Date(event.timestamp).toLocaleTimeString("en-US", {
                            hour12: false,
                          })}
                        </td>
                        <td className={`px-4 py-2 font-semibold ${PROTOCOL_COLORS[event.protocol] ?? "text-slate-400"}`}>
                          {event.protocol}
                        </td>
                        <td className="px-4 py-2 text-slate-300 font-mono text-xs">
                          <IpLabel ip={event.src_ip} />
                          {event.src_port ? <span className="text-slate-500">:{event.src_port}</span> : ""}
                        </td>
                        <td className="px-4 py-2 text-slate-300 font-mono text-xs">
                          <IpLabel ip={event.dst_ip} />
                          {event.dst_port ? <span className="text-slate-500">:{event.dst_port}</span> : ""}
                        </td>
                        <td className={`px-4 py-2 ${DIR_COLORS[event.direction] ?? "text-slate-400"}`}>
                          {event.direction}
                        </td>
                        <td className="px-4 py-2 text-slate-400">{formatBytes(event.bytes_sent)}</td>
                        <td className="px-4 py-2 text-slate-600">{event.flags ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
    </div>
  );
};
