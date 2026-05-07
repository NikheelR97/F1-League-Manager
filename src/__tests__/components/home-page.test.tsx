import { render, screen } from "@testing-library/react";

import Home from "@/app/page";

describe("Home page", () => {
  it("renders the project name and sprint status", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: "F1 Esports League Manager" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sprint 0")).toBeInTheDocument();
  });
});
