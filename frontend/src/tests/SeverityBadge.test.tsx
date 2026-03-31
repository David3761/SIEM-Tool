import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeverityBadge } from "../components/shared/SeverityBadge";

describe("SeverityBadge", () => {
  it("renders 'Critical' with red color class for critical severity", () => {
    const { container } = render(<SeverityBadge severity="critical" />);
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-red-400");
    expect(container.firstChild).toHaveClass("bg-red-900/50");
  });

  it("renders 'High' with orange color class for high severity", () => {
    const { container } = render(<SeverityBadge severity="high" />);
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-orange-400");
    expect(container.firstChild).toHaveClass("bg-orange-900/50");
  });

  it("renders 'Medium' with yellow color class for medium severity", () => {
    const { container } = render(<SeverityBadge severity="medium" />);
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-yellow-400");
    expect(container.firstChild).toHaveClass("bg-yellow-900/50");
  });

  it("renders 'Low' with blue color class for low severity", () => {
    const { container } = render(<SeverityBadge severity="low" />);
    expect(screen.getByText("Low")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-blue-400");
    expect(container.firstChild).toHaveClass("bg-blue-900/50");
  });

  it("accepts additional className", () => {
    const { container } = render(<SeverityBadge severity="low" className="extra-class" />);
    expect(container.firstChild).toHaveClass("extra-class");
  });
});
