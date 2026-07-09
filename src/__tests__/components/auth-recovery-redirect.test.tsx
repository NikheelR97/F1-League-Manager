import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthRecoveryRedirect } from "@/components/auth/AuthRecoveryRedirect";

const replace = vi.fn();
let pathname = "/";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => pathname,
}));

const setSession = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { setSession } }),
}));

const RECOVERY_HASH =
  "#access_token=acc123&refresh_token=ref456&expires_in=3600&token_type=bearer&type=recovery";

describe("AuthRecoveryRedirect (implicit/hash recovery flow)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = "/";
    setSession.mockResolvedValue({ data: {}, error: null });
    window.history.replaceState(null, "", "/");
  });

  it("establishes the session from the hash tokens and redirects to /reset-password", async () => {
    window.location.hash = RECOVERY_HASH;
    render(<AuthRecoveryRedirect />);

    await waitFor(() =>
      expect(setSession).toHaveBeenCalledWith({
        access_token: "acc123",
        refresh_token: "ref456",
      }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/reset-password"));
  });

  it("does not redirect if setSession fails", async () => {
    setSession.mockResolvedValue({ data: {}, error: { message: "bad token" } });
    window.location.hash = RECOVERY_HASH;
    render(<AuthRecoveryRedirect />);

    await waitFor(() => expect(setSession).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
  });

  it("no-ops when there is no recovery hash", () => {
    window.location.hash = "";
    render(<AuthRecoveryRedirect />);

    expect(setSession).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("no-ops when the recovery hash is missing tokens", () => {
    window.location.hash = "#type=recovery";
    render(<AuthRecoveryRedirect />);

    expect(setSession).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not redirect when already on /reset-password", () => {
    pathname = "/reset-password";
    window.location.hash = RECOVERY_HASH;
    render(<AuthRecoveryRedirect />);

    expect(setSession).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
