import React, { useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { Dashboard } from "./pages/Dashboard";
import { Alerts } from "./pages/Alerts";
import { Events } from "./pages/Events";
import { Incidents } from "./pages/Incidents";
import { IncidentDetail } from "./pages/IncidentDetail";
import { Settings } from "./pages/Settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/alerts": "Alerts",
  "/events": "Events",
  "/incidents": "Incidents",
  "/settings": "Settings",
};

function AppLayout() {
  const location = useLocation();
  const [wsConnected, setWsConnected] = useState(false);

  const handleWsConnect = useCallback((connected: boolean) => {
    setWsConnected(connected);
  }, []);

  const title =
    PAGE_TITLES[location.pathname] ??
    (location.pathname.startsWith("/incidents/") ? "Incident Detail" : "SentinelIQ");

  return (
    <div className="flex h-screen bg-slate-900 text-slate-100 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar title={title} isWsConnected={wsConnected} />
        <main className="flex flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<Dashboard onWsConnect={handleWsConnect} />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/events" element={<Events />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/incidents/:id" element={<IncidentDetail />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppLayout />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#1e293b",
              color: "#e2e8f0",
              border: "1px solid #334155",
              fontFamily: "monospace",
              fontSize: "13px",
            },
            error: {
              iconTheme: { primary: "#f87171", secondary: "#1e293b" },
            },
            success: {
              iconTheme: { primary: "#4ade80", secondary: "#1e293b" },
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
