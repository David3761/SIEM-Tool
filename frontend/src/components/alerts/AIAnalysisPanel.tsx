import React from "react";
import type { AIAnalysis } from "../../types";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { AlertTriangle, Bot, ShieldCheck, Target, Zap } from "lucide-react";

interface AIAnalysisPanelProps {
  analysis: AIAnalysis | null;
}

export const AIAnalysisPanel: React.FC<AIAnalysisPanelProps> = ({ analysis }) => {
  if (analysis === null) {
    return (
      <div className="space-y-4">
        <AgentHeader />
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-slate-500">
          <LoadingSpinner size="lg" />
          <p className="text-sm font-mono">Analyzing threat…</p>
        </div>
      </div>
    );
  }

  if (analysis.error) {
    return (
      <div className="space-y-4">
        <AgentHeader />
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 flex gap-3">
          <AlertTriangle size={16} className="text-yellow-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-mono font-semibold text-yellow-400">Analysis Error</p>
            <p className="text-sm font-mono text-yellow-300/80 mt-1">{analysis.error}</p>
          </div>
        </div>
      </div>
    );
  }

  const confidencePct = Math.round((analysis.confidence ?? 0) * 100);

  return (
    <div className="space-y-4">
      <AgentHeader analyzedAt={analysis.analyzed_at} />

      {/* Threat Assessment */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={14} className="text-cyan-400" />
          <p className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
            Threat Assessment
          </p>
        </div>
        <p className="text-sm font-mono text-slate-200 leading-relaxed">
          {analysis.threat_assessment}
        </p>
        {analysis.severity_justification && (
          <p className="text-xs font-mono text-slate-500 mt-1 leading-relaxed">
            {analysis.severity_justification}
          </p>
        )}
      </div>

      {/* MITRE */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Target size={14} className="text-cyan-400" />
          <p className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
            MITRE ATT&CK
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-xs font-mono text-slate-200">
            {analysis.mitre_tactic}
          </span>
          <span className="px-2 py-1 bg-cyan-900/30 border border-cyan-700/50 rounded text-xs font-mono text-cyan-300">
            {analysis.mitre_technique}
          </span>
        </div>
      </div>

      {/* Confidence + Risk Score */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">
              Confidence
            </p>
            <span className="text-xs font-mono text-slate-300">{confidencePct}%</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${confidencePct}%` }}
            />
          </div>
          {analysis.is_false_positive_likely && (
            <p className="text-xs font-mono text-yellow-400 mt-1.5">
              ⚠ False positive likely
            </p>
          )}
        </div>
        {analysis.risk_score != null && (
          <div>
            <p className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Risk Score
            </p>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-mono font-bold ${riskColor(analysis.risk_score)}`}>
                {analysis.risk_score}
              </span>
              <span className="text-xs font-mono text-slate-500">/ 10</span>
            </div>
          </div>
        )}
      </div>

      {/* Recommended Action */}
      <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 flex gap-2">
        <Zap size={14} className="text-blue-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-xs font-mono font-semibold text-blue-400 mb-1">Recommended Action</p>
          <p className="text-sm font-mono text-blue-200/80">{analysis.recommended_action}</p>
        </div>
      </div>

      {/* IOCs */}
      {(analysis.iocs ?? []).length > 0 && (
        <div>
          <p className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Indicators of Compromise
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(analysis.iocs ?? []).map((ioc, i) => (
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

      <p className="text-xs font-mono text-slate-600 border-t border-slate-800 pt-3">
        This assessment was generated automatically by an AI model and may contain errors. Always verify findings before taking action.
      </p>
    </div>
  );
};

function riskColor(score: number): string {
  if (score >= 8) return "text-red-400";
  if (score >= 5) return "text-orange-400";
  return "text-yellow-400";
}

function AgentHeader({ analyzedAt }: { analyzedAt?: string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 bg-slate-900/60 border border-slate-700/50 rounded-lg">
      <div className="flex items-center gap-2">
        <Bot size={13} className="text-cyan-400" />
        <span className="text-xs font-mono font-semibold text-cyan-400">Agent 1 — Threat Analyst</span>
        <span className="text-xs font-mono text-slate-500">analyzed this alert</span>
      </div>
      {analyzedAt && (
        <span className="text-xs font-mono text-slate-600">
          {new Date(analyzedAt).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
