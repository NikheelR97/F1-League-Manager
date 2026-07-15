import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom";

import { AddDriversGrid } from "@/components/admin/AddDriversGrid";

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const teams = [{ id: "t1", name: "Red Bull" }];

function stubFetch(bulkResponse: Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) =>
      url === "/api/csrf"
        ? Promise.resolve(new Response(JSON.stringify({ token: "test-token" })))
        : Promise.resolve(bulkResponse),
    ),
  );
}

async function waitForCsrf() {
  await waitFor(() =>
    expect(screen.getByRole("button", { name: /add 0 drivers/i })).not.toBeDisabled(),
  );
}

describe("AddDriversGrid", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fills the grid from a pasted roster", async () => {
    stubFetch(new Response(JSON.stringify({ added: 0, skipped: 0 })));
    render(<AddDriversGrid leagueId="league-1" teams={teams} />);

    const textarea = screen.getByLabelText(/paste a roster/i);
    await userEvent.type(textarea, "Max Verstappen 1\nLando Norris 4");
    await userEvent.click(screen.getByRole("button", { name: /add to grid/i }));

    expect(await screen.findByDisplayValue("Max Verstappen")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Lando Norris")).toBeInTheDocument();
    expect(screen.getByDisplayValue("1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("4")).toBeInTheDocument();
    expect(textarea).toHaveValue("");
  });

  it("posts the batch with CSRF and reports added/skipped counts", async () => {
    stubFetch(new Response(JSON.stringify({ added: 2, skipped: 0 }), { status: 201 }));
    render(<AddDriversGrid leagueId="league-1" teams={teams} />);
    await waitForCsrf();

    await userEvent.type(screen.getByLabelText("Driver name row 1"), "Max Verstappen");
    await userEvent.type(screen.getByLabelText("Driver name row 2"), "Lando Norris");

    await userEvent.click(screen.getByRole("button", { name: /add 2 drivers/i }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/leagues/league-1/drivers/bulk",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "x-csrf-token": "test-token" }),
        }),
      ),
    );

    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (args: unknown[]) => args[0] === "/api/admin/leagues/league-1/drivers/bulk",
    );
    const body = JSON.parse((call?.[1] as RequestInit).body as string);
    expect(body.drivers).toHaveLength(2);

    expect(await screen.findByText(/added 2 drivers/i)).toBeInTheDocument();
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
  });

  it("shows an error when the request fails", async () => {
    stubFetch(new Response(JSON.stringify({ error: "Failed to add drivers" }), { status: 500 }));
    render(<AddDriversGrid leagueId="league-1" teams={teams} />);
    await waitForCsrf();

    await userEvent.type(screen.getByLabelText("Driver name row 1"), "Max Verstappen");
    await userEvent.click(screen.getByRole("button", { name: /add 1 driver/i }));

    expect(await screen.findByText("Failed to add drivers")).toBeInTheDocument();
  });
});
