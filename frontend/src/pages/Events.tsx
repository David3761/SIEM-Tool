import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { getEvents, type EventsParams } from "../api/events";
import { Pagination } from "../components/shared/Pagination";
import { LoadingSpinner } from "../components/shared/LoadingSpinner";

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
  const [filters, setFilters] = useState<Filters>({
    src_ip: "",
    dst_ip: "",
    protocol: "",
    direction: "",
    port: "",
  });

  const debounced = useDebounce(filters, 400);

  const queryParams: EventsParams = {
    page,
    limit: 50,
    ...(debounced.src_ip && { src_ip: debounced.src_ip }),
    ...(debounced.dst_ip && { dst_ip: debounced.dst_ip }),
    ...(debounced.protocol && { protocol: debounced.protocol }),
    ...(debounced.direction && { direction: debounced.direction }),
    ...(debounced.port && { port: Number(debounced.port) }),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["events", queryParams],
    queryFn: () => getEvents(queryParams),
  });

  const update = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters((prev) => ({ ...prev, [key]: e.target.value }));
    setPage(1);
  };

  const inputClass =
    "bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50";

  return (
    <div className="flex-1 overflow-auto p-6 space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
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
                        <td className="px-4 py-2 text-slate-300">
                          {event.src_ip}
                          {event.src_port ? `:${event.src_port}` : ""}
                        </td>
                        <td className="px-4 py-2 text-slate-300">
                          {event.dst_ip}
                          {event.dst_port ? `:${event.dst_port}` : ""}
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
