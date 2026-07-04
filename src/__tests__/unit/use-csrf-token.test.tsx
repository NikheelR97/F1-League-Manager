import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCsrfToken } from "@/lib/hooks/use-csrf-token";

describe("useCsrfToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("dedupes concurrent mounts into a single fetch", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ token: "shared-token" }))),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = renderHook(() => useCsrfToken());
    const second = renderHook(() => useCsrfToken());

    await waitFor(() => expect(first.result.current).toBe("shared-token"));
    await waitFor(() => expect(second.result.current).toBe("shared-token"));

    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});
