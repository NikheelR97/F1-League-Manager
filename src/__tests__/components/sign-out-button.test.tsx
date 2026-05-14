import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignOutButton } from "@/components/auth/SignOutButton";

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};
const signOut = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signOut },
  }),
}));

describe("SignOutButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOut.mockResolvedValue({ error: null });
  });

  it("signs out and returns to login", async () => {
    const user = userEvent.setup();
    render(<SignOutButton />);

    await user.click(screen.getByRole("button", { name: "Sign out" }));

    expect(signOut).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/login");
    expect(router.refresh).toHaveBeenCalled();
  });
});
