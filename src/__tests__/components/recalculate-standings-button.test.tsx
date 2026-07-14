import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";

import { RecalculateStandingsButton } from "@/components/admin/RecalculateStandingsButton";

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

describe("RecalculateStandingsButton (S13-B4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts to the recalculate endpoint with the CSRF header and refreshes on success", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/csrf") {
        return Promise.resolve(new Response(JSON.stringify({ token: "test-token" })));
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<RecalculateStandingsButton leagueId="league-1" />);

    const button = await screen.findByRole("button", { name: /recalculate standings/i });
    await waitFor(() => expect(button).not.toBeDisabled());

    await userEvent.click(button);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/leagues/league-1/recalculate",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "x-csrf-token": "test-token" }),
        }),
      ),
    );
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("shows an error message and does not refresh when the request fails", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/csrf") {
        return Promise.resolve(new Response(JSON.stringify({ token: "test-token" })));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: "Recalc failed" }), { status: 500 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<RecalculateStandingsButton leagueId="league-1" />);

    const button = await screen.findByRole("button", { name: /recalculate standings/i });
    await waitFor(() => expect(button).not.toBeDisabled());

    await userEvent.click(button);

    expect(await screen.findByText("Recalc failed")).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
