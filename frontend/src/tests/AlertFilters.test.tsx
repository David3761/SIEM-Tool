import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertFilters, type AlertFilterState } from "../components/alerts/AlertFilters";

const defaultFilters: AlertFilterState = {
  search: "",
  severity: "",
  status: "",
  sort_by: "timestamp",
  sort_dir: "desc",
};

describe("AlertFilters", () => {
  it("renders all filter controls", () => {
    render(<AlertFilters filters={defaultFilters} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Search alerts/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("All Severities")).toBeInTheDocument();
    expect(screen.getByDisplayValue("All Statuses")).toBeInTheDocument();
  });

  it("calls onChange with updated search when text is typed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AlertFilters filters={defaultFilters} onChange={onChange} />);

    const input = screen.getByPlaceholderText(/Search alerts/i);
    await user.type(input, "port");

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.stringContaining("p") })
    );
  });

  it("calls onChange when severity filter changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AlertFilters filters={defaultFilters} onChange={onChange} />);

    await user.selectOptions(screen.getByDisplayValue("All Severities"), "critical");

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "critical" })
    );
  });

  it("calls onChange when status filter changes", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AlertFilters filters={defaultFilters} onChange={onChange} />);

    await user.selectOptions(screen.getByDisplayValue("All Statuses"), "open");

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: "open" })
    );
  });

  it("toggles sort direction when direction button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AlertFilters filters={defaultFilters} onChange={onChange} />);

    // Default sort_dir is "desc", so button shows "↓"
    const sortBtn = screen.getByText("↓");
    await user.click(sortBtn);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ sort_dir: "asc" })
    );
  });

  it("reflects current filter values in the UI", () => {
    render(
      <AlertFilters
        filters={{ ...defaultFilters, search: "existing search" }}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByDisplayValue("existing search")).toBeInTheDocument();
  });
});
