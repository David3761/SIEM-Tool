import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AlertsTable } from "../components/alerts/AlertsTable";
import { server } from "./server";
import { mockAlert, mockAlertNullAnalysis } from "./handlers";
import type { Alert } from "../types";

beforeAll(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("AlertsTable", () => {
  it("renders alert rows from provided data", () => {
    const alerts: Alert[] = [mockAlert, mockAlertNullAnalysis];
    const onSelect = vi.fn();
    renderWithQuery(<AlertsTable alerts={alerts} onSelect={onSelect} />);

    expect(screen.getByText("Port Scan Detected")).toBeInTheDocument();
    // Both rows should be visible (same rule_name in mock data)
    const rows = screen.getAllByText("Port Scan Detected");
    expect(rows).toHaveLength(2);
  });

  it("shows 'no alerts' message when list is empty", () => {
    renderWithQuery(<AlertsTable alerts={[]} onSelect={vi.fn()} />);
    expect(screen.getByText(/No alerts match/i)).toBeInTheDocument();
  });

  it("calls onSelect with alert ID when row is clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderWithQuery(<AlertsTable alerts={[mockAlert]} onSelect={onSelect} />);

    const row = screen.getByText("Port Scan Detected").closest("tr")!;
    await user.click(row);

    expect(onSelect).toHaveBeenCalledWith("alert-1");
  });

  it("renders severity badge for each alert", () => {
    renderWithQuery(<AlertsTable alerts={[mockAlert]} onSelect={vi.fn()} />);
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("shows AI spinner for alert with null analysis", () => {
    renderWithQuery(<AlertsTable alerts={[mockAlertNullAnalysis]} onSelect={vi.fn()} />);
    expect(screen.getByText(/Analyzing/i)).toBeInTheDocument();
  });

  it("shows AI confidence for alert with completed analysis", () => {
    renderWithQuery(<AlertsTable alerts={[mockAlert]} onSelect={vi.fn()} />);
    expect(screen.getByText(/87%/i)).toBeInTheDocument();
  });

  it("shows False Positive button for non-false-positive alerts", () => {
    renderWithQuery(<AlertsTable alerts={[mockAlert]} onSelect={vi.fn()} />);
    expect(screen.getByTitle("Mark as False Positive")).toBeInTheDocument();
  });

  it("does not show False Positive button for already-false-positive alerts", () => {
    const fpAlert: Alert = { ...mockAlert, status: "false_positive" };
    renderWithQuery(<AlertsTable alerts={[fpAlert]} onSelect={vi.fn()} />);
    expect(screen.queryByTitle("Mark as False Positive")).not.toBeInTheDocument();
  });

  it("calls PATCH API when False Positive button is clicked", async () => {
    const user = userEvent.setup();
    let patchCalled = false;

    const { http, HttpResponse } = await import("msw");
    server.use(
      http.patch("http://localhost:8000/api/alerts/:id", () => {
        patchCalled = true;
        return HttpResponse.json({ ...mockAlert, status: "false_positive" });
      })
    );

    renderWithQuery(<AlertsTable alerts={[mockAlert]} onSelect={vi.fn()} />);

    const fpBtn = screen.getByTitle("Mark as False Positive");
    await user.click(fpBtn);

    await waitFor(() => {
      expect(patchCalled).toBe(true);
    });
  });
});
