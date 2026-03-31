import React from "react";
import type { TimelineEvent } from "../../types";
import { Clock, AlertCircle } from "lucide-react";

interface IncidentTimelineProps {
  timeline: TimelineEvent[];
}

export const IncidentTimeline: React.FC<IncidentTimelineProps> = ({ timeline }) => {
  if (timeline.length === 0) {
    return (
      <div className="text-center py-8 text-slate-600 font-mono text-sm">
        No timeline events recorded
      </div>
    );
  }

  return (
    <div className="relative">
      {/* vertical line */}
      <div className="absolute left-[7.5rem] top-0 bottom-0 w-px bg-slate-700" />

      <div className="space-y-4">
        {timeline.map((item, i) => (
          <div key={i} className="flex gap-4 relative">
            {/* timestamp */}
            <div className="w-28 shrink-0 text-right pt-0.5">
              <span className="text-xs font-mono text-slate-500">
                {new Date(item.timestamp).toLocaleTimeString("en-US", {
                  hour12: false,
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </div>

            {/* dot */}
            <div className="relative z-10 flex items-center justify-center w-4 h-4 rounded-full bg-slate-800 border-2 border-cyan-500/60 mt-0.5 shrink-0" />

            {/* content */}
            <div className="flex-1 pb-4">
              <p className="text-sm font-mono text-slate-200 leading-tight">{item.event}</p>
              {item.alert && (
                <div className="flex items-center gap-1 mt-1">
                  <AlertCircle size={11} className="text-orange-400" />
                  <span className="text-xs font-mono text-orange-400">{item.alert}</span>
                </div>
              )}
              <p className="text-xs font-mono text-slate-500 mt-1">{item.significance}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
