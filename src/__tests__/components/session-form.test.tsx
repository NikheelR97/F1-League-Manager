import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionForm } from "@/components/admin/SessionForm";

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const circuits = [{ country: "Bahrain", id: "circuit-1", name: "Sakhir" }];
const pointsSystems = [{ id: "ps-1", name: "Standard F1 Points" }];

describe("SessionForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/csrf") {
          return Promise.resolve(
            new Response(JSON.stringify({ token: "test-token" })),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ session: { id: "session-1" } }), {
            status: 201,
          }),
        );
      }),
    );
  });

  it("submits default race number and race length as numbers, not strings", async () => {
    const user = userEvent.setup();
    render(
      <SessionForm circuits={circuits} leagueId="league-1" pointsSystems={pointsSystems} />,
    );

    await user.selectOptions(screen.getByLabelText("Circuit"), "circuit-1");
    await user.type(screen.getByLabelText("Scheduled date & time"), "2026-07-05T14:00");
    // Click the radios (not just accept defaults) — this is what triggers
    // react-hook-form's onChange path, where valueAsNumber silently no-ops.
    await user.click(screen.getByRole("radio", { name: "Race 1 (Feature)" }));
    await user.click(screen.getByRole("radio", { name: "50%" }));
    await user.click(screen.getByRole("button", { name: "Create Session" }));

    // Radio-backed numeric fields must not fail z.literal(number) validation
    // (react-hook-form's valueAsNumber does not apply to radio inputs).
    expect(screen.queryByText(/Invalid input/i)).not.toBeInTheDocument();

    const postCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([url]) => url === "/api/admin/leagues/league-1/sessions",
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse(postCall![1].body);
    expect(body.race_number).toBe(1);
    expect(body.race_length_percent).toBe(50);
  });
});
