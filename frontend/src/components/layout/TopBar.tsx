import React from "react";
import { Wifi, WifiOff } from "lucide-react";

interface TopBarProps {
  title: string;
  isWsConnected: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ title, isWsConnected }) => {
  return (
    <header className="h-14 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between px-6 shrink-0 sticky top-0 z-10">
      <h1 className="text-slate-100 font-mono font-semibold text-sm tracking-wider uppercase">
        {title}
      </h1>
      <div className="flex items-center gap-2">
        {isWsConnected ? (
          <div className="flex items-center gap-1.5 text-xs font-mono text-green-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <Wifi size={12} />
            Live
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs font-mono text-slate-500">
            <WifiOff size={12} />
            Disconnected
          </div>
        )}
      </div>
    </header>
  );
};
