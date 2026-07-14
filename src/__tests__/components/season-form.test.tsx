import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";

import { SeasonForm } from "@/components/admin/SeasonForm";

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("SeasonForm name placeholder (S13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ token: "test-token" })))),
    );
  });

  it("suggests 'Season 1' for a league with no seasons yet", () => {
    render(<SeasonForm leagueId="league-1" seasonCount={0} />);
    expect(screen.getByPlaceholderText("Season 1")).toBeInTheDocument();
  });

  it("suggests the next season number based on the existing count", () => {
    render(<SeasonForm leagueId="league-1" seasonCount={2} />);
    expect(screen.getByPlaceholderText("Season 3")).toBeInTheDocument();
  });
});
