import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

const resetPasswordForEmail = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { resetPasswordForEmail },
  }),
}));

// redirectTo is built from window.location.origin (jsdom: http://localhost:3000).

describe("ForgotPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
  });

  it("renders email and submit controls", () => {
    render(<ForgotPasswordForm />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeInTheDocument();
  });

  it("shows a validation error for an invalid email and does not call Supabase", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("calls resetPasswordForEmail with a callback redirectTo built from the site URL", async () => {
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Email"), "racer@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "racer@example.com",
      expect.objectContaining({
        redirectTo: "http://localhost:3000/auth/callback?next=/reset-password",
      }),
    );
  });

  it("shows a neutral confirmation and never reveals whether the email exists", async () => {
    const user = userEvent.setup();
    resetPasswordForEmail.mockResolvedValueOnce({
      data: null,
      error: { message: "User not found" },
    });
    render(<ForgotPasswordForm />);

    await user.type(screen.getByLabelText("Email"), "unknown@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));

    const confirmation = await screen.findByRole("status");
    expect(confirmation).toHaveTextContent(
      "If an account exists for that email, we've sent a reset link.",
    );
  });
});
