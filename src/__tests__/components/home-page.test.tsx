import { render, screen } from "@testing-library/react";

import Home from "@/app/page";

describe("Home page", () => {
  it("renders the league directory and links", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "F1 Esports League Manager" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Informal League" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Standard League" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open League" })).toHaveLength(2);
  });
});
