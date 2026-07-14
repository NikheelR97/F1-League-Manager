import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("SeasonForm submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts the season and refreshes on success", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/csrf") {
        return Promise.resolve(new Response(JSON.stringify({ token: "test-token" })));
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SeasonForm leagueId="league-1" seasonCount={0} />);

    await userEvent.type(screen.getByLabelText("Name"), "Season One");
    await userEvent.type(screen.getByLabelText("Start Date"), "2026-01-01");
    await userEvent.click(screen.getByRole("button", { name: /create season/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/leagues/league-1/seasons",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("shows a root error message when the request fails", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/csrf") {
        return Promise.resolve(new Response(JSON.stringify({ token: "test-token" })));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: "Season overlaps" }), { status: 400 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SeasonForm leagueId="league-1" seasonCount={0} />);

    await userEvent.type(screen.getByLabelText("Name"), "Season One");
    await userEvent.type(screen.getByLabelText("Start Date"), "2026-01-01");
    await userEvent.click(screen.getByRole("button", { name: /create season/i }));

    expect(await screen.findByText("Season overlaps")).toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });
});
