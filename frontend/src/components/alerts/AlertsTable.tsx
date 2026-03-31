import React from "react";
import type { Alert } from "../../types";
import { AlertRow } from "./AlertRow";

interface AlertsTableProps {
  alerts: Alert[];
  onSelect: (id: string) => void;
}

export const AlertsTable: React.FC<AlertsTableProps> = ({ alerts, onSelect }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px]">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="px-4 py-2.5 text-left text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider">
              Severity
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider">
              Rule
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider">
              Traffic
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider">
              AI
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider">
              Time
            </th>
            <th className="px-4 py-2.5 text-left text-xs font-mono font-semibold text-slate-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {alerts.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-slate-600 font-mono text-sm">
                No alerts match the current filters
              </td>
            </tr>
          ) : (
            alerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} onSelect={onSelect} />
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
