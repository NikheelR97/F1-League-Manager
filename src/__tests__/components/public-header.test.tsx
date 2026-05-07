import { render, screen } from "@testing-library/react";

import { PublicHeader } from "@/components/layout/PublicHeader";

describe("PublicHeader", () => {
  it("renders primary league links", () => {
    render(<PublicHeader />);

    expect(screen.getByRole("link", { name: /F1 League Manager/i })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getAllByRole("link", { name: "Informal" })[0]).toHaveAttribute(
      "href",
      "/leagues/informal",
    );
    expect(screen.getAllByRole("link", { name: "Standard" })[0]).toHaveAttribute(
      "href",
      "/leagues/standard",
    );
    expect(screen.getByLabelText("Open navigation")).toBeInTheDocument();
  });
});
