import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("PointsSystemForm position editor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify({ token: "test-token" })))),
    );
  });

  it("adds and removes position rows", async () => {
    render(<PointsSystemForm leagueId="league-1" />);
    const before = screen.getAllByLabelText(/Points for position/i).length;

    // Standard points already fill all 10 editable slots, so remove one to
    // free a slot before the "+ Add position" button appears.
    await userEvent.click(screen.getAllByLabelText(/Remove position/i)[0]);
    expect(screen.getAllByLabelText(/Points for position/i)).toHaveLength(before - 1);

    await userEvent.click(screen.getByRole("button", { name: /add position/i }));
    expect(screen.getAllByLabelText(/Points for position/i)).toHaveLength(before);
  });

  it("resets rows to the F1 standard points", async () => {
    render(<PointsSystemForm leagueId="league-1" />);

    await userEvent.click(screen.getAllByLabelText(/Remove position/i)[0]);
    await userEvent.click(screen.getByRole("button", { name: /use f1 standard/i }));

    expect(screen.getAllByLabelText(/Points for position/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Points for position 1")).toHaveValue(25);
  });
});

describe("PointsSystemForm submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts the points system and navigates back to the league on success", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/csrf") {
        return Promise.resolve(new Response(JSON.stringify({ token: "test-token" })));
      }
      return Promise.resolve(new Response(null, { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PointsSystemForm leagueId="league-1" />);
    await userEvent.click(screen.getByRole("button", { name: /create points system/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/leagues/league-1/points-systems",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/admin/leagues/league-1"));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows a root error message when the request fails", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === "/api/csrf") {
        return Promise.resolve(new Response(JSON.stringify({ token: "test-token" })));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ error: "Name already used" }), { status: 400 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PointsSystemForm leagueId="league-1" />);
    await userEvent.click(screen.getByRole("button", { name: /create points system/i }));

    expect(await screen.findByText("Name already used")).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });
});
