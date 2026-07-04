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
});
