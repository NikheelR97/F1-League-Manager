import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/auth/LoginForm";

const router = {
  push: vi.fn(),
  refresh: vi.fn(),
};

const signInWithPassword = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithPassword },
    from,
  }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: { role: "admin" } });
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "00000000-0000-4000-8000-000000000001" } },
      error: null,
    });
  });

  it("renders email, password, and submit controls", () => {
    render(<LoginForm nextPath={null} />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows validation errors for invalid input", async () => {
    const user = userEvent.setup();
    render(<LoginForm nextPath={null} />);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("shows a safe generic error for failed login", async () => {
    const user = userEvent.setup();
    signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    render(<LoginForm nextPath={null} />);

    await user.type(screen.getByLabelText("Email"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email or password is incorrect.",
    );
    expect(router.push).not.toHaveBeenCalled();
  });

  it("uses the safe next path after successful login", async () => {
    const user = userEvent.setup();
    render(<LoginForm nextPath="/garage" />);

    await user.type(screen.getByLabelText("Email"), "racer@example.com");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(router.push).toHaveBeenCalledWith("/garage");
    expect(from).not.toHaveBeenCalled();
  });

  it("falls back to the profile role when next is absent", async () => {
    const user = userEvent.setup();
    render(<LoginForm nextPath={null} />);

    await user.type(screen.getByLabelText("Email"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(from).toHaveBeenCalledWith("profiles");
    expect(eq).toHaveBeenCalledWith("id", "00000000-0000-4000-8000-000000000001");
    expect(router.push).toHaveBeenCalledWith("/admin");
  });
});
