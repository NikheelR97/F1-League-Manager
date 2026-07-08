import { render, screen } from "@testing-library/react";

import { PublicHeader } from "@/components/layout/PublicHeader";

describe("PublicHeader", () => {
  it("renders league links from props", () => {
    const leagueLinks = [
      { href: "/leagues/standard", label: "Standard League" },
      { href: "/leagues/informal", label: "Informal League" },
    ];

    render(<PublicHeader leagueLinks={leagueLinks} />);

    const standardLink = screen.getAllByText("Standard League")[0] as HTMLAnchorElement;
    const informalLink = screen.getAllByText("Informal League")[0] as HTMLAnchorElement;
    const garageLink = screen.getAllByText("Garage")[0] as HTMLAnchorElement;

    expect(standardLink.href).toContain("/leagues/standard");
    expect(informalLink.href).toContain("/leagues/informal");
    expect(garageLink.href).toContain("/garage");
    expect(screen.getByLabelText("Open navigation")).toBeTruthy();
  });

  it("renders gracefully with zero public leagues", () => {
    render(<PublicHeader leagueLinks={[]} />);

    // Should render header with home and garage links, but no league links
    expect(screen.getByText("F1 League Manager")).toBeTruthy();
    expect(screen.getAllByText("Garage")[0]).toBeTruthy();
    expect(screen.queryByText("Standard League")).toBeNull();
    expect(screen.getByLabelText("Open navigation")).toBeTruthy();
  });
});
