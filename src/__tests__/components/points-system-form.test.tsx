import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";

import { PointsSystemForm } from "@/components/admin/PointsSystemForm";

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("PointsSystemForm retroactive rescore notice (S13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ token: "test-token" })))),
    );
  });

  it("warns up front when editing a system used by published rounds", () => {
    render(
      <PointsSystemForm leagueId="league-1" pointsSystemId="ps-1" publishedSessionCount={2} />,
    );
    expect(screen.getByText(/rescore 2 published rounds/i)).toBeInTheDocument();
  });

  it("does not show the notice when creating a new points system", () => {
    render(<PointsSystemForm leagueId="league-1" />);
    expect(screen.queryByText(/rescore/i)).not.toBeInTheDocument();
  });
});
