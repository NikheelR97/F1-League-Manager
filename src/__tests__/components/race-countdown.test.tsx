import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RaceCountdownClient } from "@/components/league/RaceCountdownClient";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("RaceCountdownClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-03T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    setVisibility("visible");
  });

  it("shows Awaiting schedule when there is no target", () => {
    render(
      <RaceCountdownClient initialNowIso="2026-07-03T10:00:00Z" targetIso={null} />,
    );
    expect(screen.getByText("Awaiting schedule")).toBeInTheDocument();
  });

  it("shows Race ready when the target has passed", () => {
    render(
      <RaceCountdownClient
        initialNowIso="2026-07-03T10:00:00Z"
        targetIso="2026-07-03T09:00:00Z"
      />,
    );
    expect(screen.getByText("Race ready")).toBeInTheDocument();
  });

  it("ticks the countdown every minute", () => {
    render(
      <RaceCountdownClient
        initialNowIso="2026-07-03T10:00:00Z"
        targetIso="2026-07-03T12:00:30Z"
      />,
    );
    expect(screen.getByText("0d 2h 0m")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText("0d 1h 59m")).toBeInTheDocument();
  });

  it("pauses while the tab is hidden and refreshes on return", () => {
    render(
      <RaceCountdownClient
        initialNowIso="2026-07-03T10:00:00Z"
        targetIso="2026-07-03T12:00:30Z"
      />,
    );
    expect(screen.getByText("0d 2h 0m")).toBeInTheDocument();

    act(() => {
      setVisibility("hidden");
      vi.advanceTimersByTime(10 * 60_000);
    });
    // Hidden tab: interval stopped, display unchanged
    expect(screen.getByText("0d 2h 0m")).toBeInTheDocument();

    act(() => {
      setVisibility("visible");
    });
    // Immediate refresh on becoming visible reflects the elapsed 10 minutes
    expect(screen.getByText("0d 1h 50m")).toBeInTheDocument();
  });
});
