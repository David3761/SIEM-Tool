import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AIAnalysisPanel } from "../components/alerts/AIAnalysisPanel";
import type { AIAnalysis } from "../types";

const mockAnalysis: AIAnalysis = {
  threat_assessment: "Port scan activity detected with high confidence.",
  severity_justification: "Rapid multi-port targeting observed.",
  mitre_tactic: "Discovery",
  mitre_technique: "T1046 - Network Service Discovery",
  confidence: 87,
  is_false_positive_likely: false,
  recommended_action: "Block source IP immediately.",
  iocs: ["192.168.1.100", "port-scan"],
  analyzed_at: "2024-01-15T10:30:05Z",
};

describe("AIAnalysisPanel", () => {
  it("shows loading spinner and 'AI analysis in progress' message when analysis is null", () => {
    render(<AIAnalysisPanel analysis={null} />);
    expect(screen.getByText(/AI analysis in progress/i)).toBeInTheDocument();
  });

  it("shows warning banner with error message when analysis has an error field", () => {
    const errorAnalysis: AIAnalysis = {
      ...mockAnalysis,
      error: "OpenAI timeout after 30s",
    };
    render(<AIAnalysisPanel analysis={errorAnalysis} />);
    expect(screen.getByText(/Analysis Error/i)).toBeInTheDocument();
    expect(screen.getByText("OpenAI timeout after 30s")).toBeInTheDocument();
  });

  it("renders threat assessment when analysis is complete", () => {
    render(<AIAnalysisPanel analysis={mockAnalysis} />);
    expect(
      screen.getByText("Port scan activity detected with high confidence.")
    ).toBeInTheDocument();
  });

  it("renders MITRE tactic and technique badges", () => {
    render(<AIAnalysisPanel analysis={mockAnalysis} />);
    expect(screen.getByText("Discovery")).toBeInTheDocument();
    expect(screen.getByText("T1046 - Network Service Discovery")).toBeInTheDocument();
  });

  it("renders recommended action in callout", () => {
    render(<AIAnalysisPanel analysis={mockAnalysis} />);
    expect(screen.getByText("Block source IP immediately.")).toBeInTheDocument();
    expect(screen.getByText("Recommended Action")).toBeInTheDocument();
  });

  it("renders IOCs as code tags", () => {
    render(<AIAnalysisPanel analysis={mockAnalysis} />);
    expect(screen.getByText("192.168.1.100")).toBeInTheDocument();
    expect(screen.getByText("port-scan")).toBeInTheDocument();
  });

  it("shows false positive warning when is_false_positive_likely is true", () => {
    render(<AIAnalysisPanel analysis={{ ...mockAnalysis, is_false_positive_likely: true }} />);
    expect(screen.getByText(/False positive likely/i)).toBeInTheDocument();
  });
});
