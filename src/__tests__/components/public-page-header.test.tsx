import { render, screen } from "@testing-library/react";

import { PublicPageHeader } from "@/components/league/PublicPageHeader";

describe("PublicPageHeader", () => {
  const baseProps = {
    format: "feature",
    lastRound: "Round 5 — Monaco",
    leagueName: "Standard League",
    seasonName: "Season 2",
    title: "Driver Standings",
    updatedAt: "2026-05-08T18:00:00.000Z",
  };

  it("renders the page title as a heading", () => {
    render(<PublicPageHeader {...baseProps} />);
    expect(screen.getByRole("heading", { name: /Driver Standings/i })).toBeInTheDocument();
  });

  it("shows league name, season name, last round, and format", () => {
    render(<PublicPageHeader {...baseProps} />);
    const meta = screen.getByText(/Standard League/i);
    expect(meta).toBeInTheDocument();
    expect(meta.textContent).toContain("Season 2");
    expect(meta.textContent).toContain("Round 5 — Monaco");
    // format is CSS-uppercased; textContent reflects the raw value
    expect(meta.textContent).toContain("feature");
  });

  it("shows formatted updated date when updatedAt is provided", () => {
    render(<PublicPageHeader {...baseProps} />);
    // en-GB locale: "8 May 2026"
    expect(screen.getByText(/Updated/i)).toBeInTheDocument();
    expect(screen.getByText(/8 May 2026/i)).toBeInTheDocument();
  });

  it("omits the last round segment when lastRound is null", () => {
    render(<PublicPageHeader {...baseProps} lastRound={null} />);
    const meta = screen.getByText(/Standard League/i);
    expect(meta.textContent).not.toContain("Round 5");
  });

  it("omits the updated date when updatedAt is null", () => {
    render(<PublicPageHeader {...baseProps} updatedAt={null} />);
    expect(screen.queryByText(/Updated/i)).not.toBeInTheDocument();
  });

  it("applies CSS uppercase class to the format span", () => {
    render(<PublicPageHeader {...baseProps} format="sprint" />);
    // textContent is the raw value; CSS transforms are not applied by jsdom
    const meta = screen.getByText(/Standard League/i);
    expect(meta.textContent).toContain("sprint");
    // The span carrying the format value should have the uppercase class
    const formatSpan = meta.querySelector(".uppercase");
    expect(formatSpan).not.toBeNull();
    expect(formatSpan?.textContent).toBe("sprint");
  });
});
