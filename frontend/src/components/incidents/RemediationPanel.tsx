import React from "react";
import type { AIRemediation } from "../../types";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { Info, Shield } from "lucide-react";

interface RemediationPanelProps {
  remediation: AIRemediation | null;
}

function stepBg(step: string): string {
  if (step.startsWith("IMMEDIATE")) return "bg-red-900/20 border-red-800/40";
  if (step.startsWith("SHORT-TERM")) return "bg-orange-900/20 border-orange-800/40";
  if (step.startsWith("LONG-TERM")) return "bg-yellow-900/20 border-yellow-800/40";
  return "bg-slate-800 border-slate-700";
}

function stepNumColor(step: string): string {
  if (step.startsWith("IMMEDIATE")) return "text-red-400 bg-red-900/40";
  if (step.startsWith("SHORT-TERM")) return "text-orange-400 bg-orange-900/40";
  if (step.startsWith("LONG-TERM")) return "text-yellow-400 bg-yellow-900/40";
  return "text-slate-400 bg-slate-700";
}

export const RemediationPanel: React.FC<RemediationPanelProps> = ({ remediation }) => {
  if (remediation === null) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-500">
        <LoadingSpinner size="lg" />
        <p className="text-sm font-mono">Generating AI remediation plan…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 flex gap-3">
        <Info size={16} className="text-blue-400 mt-0.5 shrink-0" />
        <p className="text-sm font-mono text-blue-200/80 leading-relaxed">{remediation.summary}</p>
      </div>

      {/* Attack pattern + MITRE */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Shield size={14} className="text-cyan-400" />
          <p className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
            Attack Pattern
          </p>
        </div>
        <p className="text-sm font-mono text-slate-300 mb-3">{remediation.attack_pattern}</p>
        <div className="flex flex-wrap gap-2">
          {remediation.mitre_tactics.map((t) => (
            <span
              key={t}
              className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs font-mono text-slate-200"
            >
              {t}
            </span>
          ))}
          {remediation.mitre_techniques.map((t) => (
            <span
              key={t}
              className="px-2 py-1 bg-cyan-900/30 border border-cyan-700/50 rounded text-xs font-mono text-cyan-300"
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Remediation Steps */}
      <div>
        <p className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Remediation Steps
        </p>
        <ol className="space-y-2">
          {remediation.remediation_steps.map((step, i) => (
            <li
              key={i}
              className={`flex gap-3 p-3 rounded-lg border ${stepBg(step)}`}
            >
              <span
                className={`text-xs font-mono font-bold w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 ${stepNumColor(step)}`}
              >
                {i + 1}
              </span>
              <p className="text-sm font-mono text-slate-200 leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* IOCs */}
      {remediation.iocs.length > 0 && (
        <div>
          <p className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
            IOCs
          </p>
          <div className="flex flex-wrap gap-1.5">
            {remediation.iocs.map((ioc, i) => (
              <code
                key={i}
                className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-300"
              >
                {ioc}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
