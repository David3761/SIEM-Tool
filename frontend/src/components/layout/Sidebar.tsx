import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Bell,
  Activity,
  FolderOpen,
  Settings,
  Shield,
} from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/alerts", icon: Bell, label: "Alerts" },
  { to: "/events", icon: Activity, label: "Events" },
  { to: "/incidents", icon: FolderOpen, label: "Incidents" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center">
            <Shield size={14} className="text-cyan-400" />
          </div>
          <span className="text-slate-100 font-mono font-semibold text-sm tracking-wider uppercase">
            SentinelIQ
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800"
              }`
            }
          >
            <Icon size={16} />
            <span className="font-mono">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-800">
        <p className="text-xs font-mono text-slate-600">v1.0.0</p>
      </div>
    </aside>
  );
};
