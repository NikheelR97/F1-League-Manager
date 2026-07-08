import { render, screen } from "@testing-library/react";

import { PositionDelta } from "@/components/ui/PositionDelta";

describe("PositionDelta", () => {
  it("shows ArrowUp (position gained) when current is better than previous", () => {
    render(<PositionDelta current={2} previous={5} />);
    expect(screen.getByLabelText("Position gained")).toBeInTheDocument();
  });

  it("shows ArrowDown (position lost) when current is worse than previous", () => {
    render(<PositionDelta current={5} previous={2} />);
    expect(screen.getByLabelText("Position lost")).toBeInTheDocument();
  });

  it("shows ArrowRight (position unchanged) when position is the same", () => {
    render(<PositionDelta current={3} previous={3} />);
    expect(screen.getByLabelText("Position unchanged")).toBeInTheDocument();
  });

  it("shows ArrowRight (position unchanged) when previous is null (first appearance)", () => {
    render(<PositionDelta current={1} previous={null} />);
    expect(screen.getByLabelText("Position unchanged")).toBeInTheDocument();
  });
});
