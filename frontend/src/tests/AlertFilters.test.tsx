import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AlertFilters, type AlertFilterState } from "../components/alerts/AlertFilters";

const defaultFilters: AlertFilterState = {
  search: "",
  severity: "",
  status: "",
  rule_id: "",
  from: "",
  to: "",
  sort_by: "timestamp",
  sort_dir: "desc",
};

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("AlertFilters", () => {
  it("renders all filter controls", () => {
    renderWithQuery(<AlertFilters filters={defaultFilters} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("All Severities")).toBeInTheDocument();
    expect(screen.getByDisplayValue("All Statuses")).toBeInTheDocument();
  });

  it("calls onChange with updated search when text is typed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithQuery(<AlertFilters filters={defaultFilters} onChange={onChange} />);

    const input = screen.getByPlaceholderText(/Search/i);
    await user.type(input, "port");

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.stringContaining("p") })
    );
  });

  it("calls onChange when severity filter changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithQuery(<AlertFilters filters={defaultFilters} onChange={onChange} />);

    await user.selectOptions(screen.getByDisplayValue("All Severities"), "critical");

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "critical" })
    );
  });

  it("calls onChange when status filter changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithQuery(<AlertFilters filters={defaultFilters} onChange={onChange} />);

    await user.selectOptions(screen.getByDisplayValue("All Statuses"), "open");

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: "open" })
    );
  });

  it("toggles sort direction when direction button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithQuery(<AlertFilters filters={defaultFilters} onChange={onChange} />);

    const sortBtn = screen.getByText("↓");
    await user.click(sortBtn);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ sort_dir: "asc" })
    );
  });

  it("reflects current filter values in the UI", () => {
    renderWithQuery(
      <AlertFilters
        filters={{ ...defaultFilters, search: "existing search" }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue("existing search")).toBeInTheDocument();
  });
});
