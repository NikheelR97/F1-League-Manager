import { render, screen } from "@testing-library/react";

import { FormStrip } from "@/components/league/FormStrip";

describe("FormStrip", () => {
  it("renders positions and DNF in order", () => {
    render(
      <FormStrip
        results={[
          { status: "classified", position: 1 },
          { status: "dnf", position: null },
          { status: "classified", position: 7 },
        ]}
      />,
    );
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["P1", "DNF", "P7"]);
  });

  it("renders nothing when empty", () => {
    const { container } = render(<FormStrip results={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
