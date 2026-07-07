"use client";

import { useEffect, useRef } from "react";

// K1/K2/K4 — every mutation seam in this app moves screen-reader focus via
// role="status"/aria-live but leaves the keyboard caret on <body>. This hook
// pairs with that existing announcement: attach the returned ref (plus
// tabIndex={-1}) to the newly-mounted region, pass the condition that turns
// true when it appears, and the keyboard caret follows the screen reader.
//
// `dep` is compared by value on every render; focus is (re)applied whenever
// it changes to a truthy value. Pass `skipInitial: true` for a region that
// can also be true on first mount (e.g. a form's default stage, or a wheel
// spin left "pending" from a previous visit) so mounting the page doesn't
// steal focus — only a later transition back into that state does.
export function useFocusOnMount<T extends HTMLElement>(dep: unknown, skipInitial = false) {
  const ref = useRef<T>(null);
  const hasSeenTruthy = useRef(false);

  useEffect(() => {
    if (!dep) return;
    if (skipInitial && !hasSeenTruthy.current) {
      hasSeenTruthy.current = true;
      return;
    }
    hasSeenTruthy.current = true;
    ref.current?.focus();
  }, [dep, skipInitial]);

  return ref;
}
