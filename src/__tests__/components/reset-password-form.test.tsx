import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

const getSession = vi.fn();
const updateUser = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getSession, updateUser },
  }),
}));

describe("ResetPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    updateUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  });

  it("shows an invalid-link message with no active session", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    render(<ResetPasswordForm />);

    expect(
      await screen.findByText("This reset link is invalid or has expired."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Request a new reset link" }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("renders the form once a recovery session is present", async () => {
    render(<ResetPasswordForm />);

    expect(await screen.findByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
  });

  it("validates minimum length and matching passwords", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await screen.findByLabelText("New password");
    await user.type(screen.getByLabelText("New password"), "short1");
    await user.type(screen.getByLabelText("Confirm new password"), "different");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(
      await screen.findByText("Password must be at least 8 characters."),
    ).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("calls updateUser with the new password and redirects to login on success", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await screen.findByLabelText("New password");
    await user.type(screen.getByLabelText("New password"), "new-secure-pass");
    await user.type(screen.getByLabelText("Confirm new password"), "new-secure-pass");
    await user.click(screen.getByRole("button", { name: "Reset password" }));

    expect(updateUser).toHaveBeenCalledWith({ password: "new-secure-pass" });
    expect(router.push).toHaveBeenCalledWith("/login?reset=success");
  });
});
