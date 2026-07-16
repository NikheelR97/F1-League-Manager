import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FormError } from "@/components/ui/FormError";

describe("FormError", () => {
  it("renders message with role='alert'", () => {
    const message = "Something went wrong";
    render(<FormError message={message} />);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent(message);
  });

  it("renders nothing when message is null", () => {
    const { container } = render(<FormError message={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when message is undefined", () => {
    const { container } = render(<FormError message={undefined} />);
    expect(container.firstChild).toBeNull();
  });

  // M10 — a bare "Forbidden" from the admin guard (CSRF/origin failure or a
  // non-admin role) gave no guidance; mapped to an actionable message here,
  // the one place every admin form's error already renders.
  it("maps a bare 'Forbidden' to a friendlier, actionable message", () => {
    render(<FormError message="Forbidden" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/admin/i);
    expect(alert).not.toHaveTextContent(/^Forbidden$/);
  });
});
