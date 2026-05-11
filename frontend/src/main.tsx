import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

async function prepare() {
  // if (import.meta.env.DEV) {
  //   // Start mock WebSocket (patches window.WebSocket for ws://localhost:8080)
  //   const { installMockWebSocket } = await import("./mocks/mockWebSocket");
  //   installMockWebSocket();
  //
  //   // Start MSW service worker (intercepts all HTTP calls to localhost:8000)
  //   const { worker } = await import("./mocks/browser");
  //   await worker.start({
  //     onUnhandledRequest: "bypass",
  //     serviceWorker: { url: "/mockServiceWorker.js" },
  //   });
  // }
}

prepare().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});
