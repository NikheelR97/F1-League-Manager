# F1 League Manager — Gap-Closing UX/QA Audit Report

_Audit 4 · follow-up pass · 9 subagents (4 Haiku collectors, 5 Sonnet judgment/synthesis) across 7 gap areas. Findings below are de-duplicated and, where they are code-level defects, verified against source by the orchestrator._

## Executive Summary

Public performance, tablet responsiveness, and dark-theme focus-indicator visibility are **healthy** — three worries the brief raised turned out to be non-problems, confirmed with measurement. The urgent findings cluster in two places: (1) a **confirmed data-integrity bug** — republishing a session with penalties re-inserts the penalty rows, double-counting penalty points into ban thresholds and standings; and (2) the **public results experience**, where every completed race dead-ends on "result not available" because standings are imported without finishing-order rows — the exact shape a real workbook import produces. Two of the three code bugs are **regressions the prior audit rounds introduced** (the "Round N" prefix and the publish-error coercion). The E2E suite remains the biggest structural gap: nothing asserts a points number on a public page, so the entire scoring pipeline is untested — a designed 23-test suite closes it and surfaced the penalty bug in the process.

---

## Findings By Gap Area

### Racer Experience & Copy

| # | Page/Flow | Issue | Severity | Fix |
|---|-----------|-------|----------|-----|
| R1 | Results/qualifying detail | Every completed race dead-ends on "No result — not yet available" while standings/stats/profiles are populated from that same race. Root cause: sessions are `completed` with `driver_standings` snapshots but zero `race_results` rows — **the shape a real workbook import produces**. | **Blocker** | Gate the "View →" affordance on `race_results` presence, OR render a standings-based fallback ("Championship after this round — full finishing order not recorded"). Don't dead-end. |
| R2 | Calendar + all results views | "Round 3 · Round 1 — Japan" — the round-3 `Round ${circuit.round_number}` prefix collides with league-authored session names that already start with "Round". **Verified** at `calendar/page.tsx:129`, `results/[sessionId]/page.tsx:79`. | **Major** | Don't prepend the circuit round when `session.name` already begins "Round"; pick one round-of-truth. |
| R3 | League hub (above the fold) | The two weekly-checker targets are buried: "Last result" is an untappable `<span>`; "Next Race" card shows no date/time; hero countdown reads "Race ready" permanently when the seeded next race is past-dated. | **Major** | Wrap "Last result" in a `Link`; add `formatDate(nextRace.scheduled_at)` to the card; guard "Race ready" against past-dated races. |
| R4 | Sub-nav (informal league) | `LeagueSubNav` hardcodes a "Wheel" tab for every league; the hub already hides the wheel for non-wheel formats but the nav doesn't, so informal racers tap into a feature the format lacks. | **Major** | Pass `isWheelLeague` into `LeagueSubNav`, drop the Wheel link when false (same gate the hub uses). |
| R5 | Wheel page | Empty state never explains what the wheel is to a newcomer. | Minor | One explanatory sentence in the empty state. |
| R6 | Standings/hub | "What changed since last week" exists (`PositionDelta`) but seed sets `previous_position === position`, so every arrow is grey/unchanged; no bridge from latest-result to standings movement. | Minor | Surface real `previous_position`; add movement to result page once R1 is fixed. |
| R7 | Racer garage | No doorway back to the league side (wordmark not a link, no header entry). The two halves never reference each other. | Minor | Link the wordmark to `/`; add a garage/user entry to `PublicHeader`. |
| R8 | All pages | Every browser tab title is identical (`F1 Esports League Manager`). | Polish | Per-page `generateMetadata` (data already fetched). |

### E2E Test Coverage

_Gap map: 36 uncovered scenarios (12 Blocker). Structural finding: no existing test asserts a points number on a public page — the scoring pipeline is E2E-blind. Designed suite: ~23 tests, ~74s total (under the 90s ceiling), zero new global-setup seeding._

| # | Missing Scenario | Why It Matters | Severity | Fix (test to add) |
|---|------------------|----------------|----------|-------------------|
| E1 | Publish stepper end-to-end → public numbers | The app's core flow has no coverage past page-load | **Blocker** | `results-publish.spec.ts` T1: publish Australia P1–P10, assert exact public standings (Ferrari 26, Rossi 18, …). |
| E2 | Republish correction | Must replace, not double-count | **Blocker** | T2: swap P1↔P2 with `republish:true`, assert sum == 101. |
| E3 | Role escalation (RACER → admin UI + API) | Security boundary untested | **Blocker** | `auth-boundaries.spec.ts` T7/T8: racer state → `/admin/leagues` blocked, admin API 403 + no row. |
| E4 | Adjustment create/delete + delta validation | Direct standings mutation untested | **Blocker** | `adjustments.spec.ts` T4/T5: 25 → +5 → 30 → delete → 25; `1e9`/non-numeric → 422. |
| E5 | Session delete recompute | Standings must rebuild correctly | **Blocker** | `lifecycle.spec.ts` T12. |
| E6 | Empty states / 404 / mobile calendar / result tabs | Weekly-hit public surfaces | Major | `public-pages.spec.ts` T16/T17/T20; result qualifying+report tabs. |

**Concurrency findings (bugs, not tests):**
- **F1 — penalty double-insert on republish — CONFIRMED (see X1).** Counted as the code bug below, not a test.
- **F2 — transfer double-submit** — no lock/dedupe/unique-constraint → two open stints possible. **Plausible, not verified.** Behavior genuinely undefined; T15 asserts "exactly one open stint" and is expected to fail, documenting it.
- **F3 — rapid identical adjustments** both apply (+5,+5 → +10). Defensible per-POST, but no idempotency key; test locks the +10 contract.
- **F4 — no penalty-id read path** — publish returns only `{sessionId}`, no admin GET-penalties route, so black-box rescind can't be tested until a read path exists.
- **F5 — league reactivate not implementable** — `ALLOWED_TRANSITIONS` has no `archived→active`; test the 422 contract instead.

### Keyboard Navigation

_No blockers, no focus traps. The brief's worry — invisible focus indicators on the dark theme — was **refuted by screenshot**: links get a red outline, inputs a 3px red ring, selects flip to f1-red, stepper controls explicit `ring-2`. Skip links are keyboard-first and visible; number-input arrow-keys survive the wheel-blur guard; the live filter is tab-clean. The recurring real gap is **post-mutation focus continuity**._

| # | Flow | Issue | Severity | Fix |
|---|------|-------|----------|-----|
| K1 | Transfer stages; publish success | Focus drops to `<body>` on stage swap / success-banner mount — the SR announcement fires but the keyboard caret lands nowhere. | **Major** | `ref` + `tabIndex={-1}` on the new stage/banner region, `.focus()` on change. |
| K2 | Penalty "Remove"; adjustment delete | Focus drops to `<body>` after the row/list mutates. | **Major** | Move focus to the next row control or the list container after removal. |
| K3 | Skip-link target | `<main id="main-content">` has no `tabIndex`, so activation scrolls but focus lands on body (works only because next Tab enters main). | Minor | `tabIndex={-1}` on `<main>`. |
| K4 | "Add Penalty"; wheel reveal; login error | New row / Void-Confirm / error alert mount but focus isn't moved to them. | Minor | Focus the new element on appearance. |

### Responsive Breakpoints (Tablet/iPad)

_768 / 834 / 1024 px, 25 page-views each. **Structurally sound**: zero horizontal overflow, every table contained in its own scroll wrapper, no meaningful truncation. All findings are tap-target sizing → collapse into 3 fixes._

| # | Page | Breakpoint | Issue | Severity | Fix |
|---|------|-----------|-------|----------|-----|
| B1 | Publish stepper, transfer, league create, wheel, garage | all | **Bare native checkboxes render 13×13px** — worst targets found, below the WCAG 2.2 24px floor. | Minor | Add `size-5` to every `type="checkbox"`. |
| B2 | Public nav + table cell links | all | Nav/brand/table-link anchors 16–21px tall. | Minor | `inline-flex items-center min-h-11` on the shared nav/cell-link classes. |
| B3 | Admin small buttons + form submits | all | Action buttons 30–38px tall. | Minor | `min-h-11` on the admin small-button class. |

### Admin Time-Pressure Micro-Optimizations

_Not separately dispatched — the race-night core flow was fixed in rounds 1–2 (grid-order prefill, live validation, wheel-blur guard, keyboard increments all confirmed holding by the keyboard + breakpoint passes). The micro-optimizations that remain surfaced as focus-continuity (K1/K2) and are captured there. No new dedicated opportunities rose above Minor._

### Microcopy Consistency and Clarity

_22 raw inconsistency clusters distilled to 10 house-style rules + a prioritized fix list. Four clusters were consciously ruled **not** violations (driver/racer, session/race, championship/standings, imperative/descriptive tone) — real semantic distinctions, not drift._

| # | Instance | Issue | Severity | Fix |
|---|----------|-------|----------|-----|
| M1 | `ResultStepper.tsx:1267` | Publish failure discards the real field-level server error (zod object) and shows "Validation failed on the server — check the review step" — vague **and wrong** (bad field isn't in the review step). **Verified.** | **Major** | Parse `flatten().fieldErrors`/`formErrors`, render the first real message; drop "check the review step". |
| M2 | `AdjustmentDeleteButton.tsx` | One control mixes Delete (aria) / Remove (confirm) / removed (success), and its success omits the recalculation disclosure its create-sibling shows. | **Major** | "Delete"/"Deleted" throughout; append "— standings recalculated." |
| M3 | `PenaltyStatusEditor` / `AdjustmentForm` | Admin dropdowns render raw enums (`rescinded`, `bonus`) while the **public** page already has a nicer `STATUS_LABEL` map — admins see blunter copy than racers. | **Major** | Reuse the existing `STATUS_LABEL`; add a `KIND_OPTIONS` label map. |
| M4 | Same-form error punctuation, label case, busy/idle verbs | LeagueForm/SessionForm/AdjustmentForm/TransferForm/SetupForm each show two variants at once (period vs none, Title vs sentence, "Saving…" on a "Create" button). | Major (same-screen) | Apply house rules: errors no period; labels sentence case; busy label = present participle of the button's verb. |
| M5 | "Unserved bans" label; reserve checkbox "(uncheck for primary)" | Jargon / self-negating labels. | Minor | "Bans owed"; drop the parenthetical. |
| M6 | Repo-wide hygiene | Remaining error-period stragglers, ellipsis (`...`→`…`), empty-state title-echoes, select-prompt shapes. | Minor/Polish | Mechanical sweep per the 10 rules. |

### Performance

| # | Page | Metric | Current | Threshold | Severity | Fix |
|---|------|--------|---------|-----------|----------|-----|
| P1 | All public pages | LCP / CLS / TBT / bytes | ≤2.17s / 0 / ≤122ms / <460KB (throttled 4G, 4× CPU) | 2.5s / 0.1 / 200ms / 1MB | **PASS** | None — healthy under harsher-than-real conditions. |
| P2 | 26 admin/`/garage`/`/login` routes | Marginal JS | 609–666 KB | 100 KB | Minor → **won't fix** | Captive desktop users, session-cached; no measurable benefit. |
| P3 | Shared baseline | JS on every route | 556 KB (≈446 KB for real browsers; 112 KB is a `nomodule` polyfill modern phones skip) | — | Info | Framework floor (React 19 + Next 16), zero app deps — not lazy-splittable. |
| P4 | — | `@sentry/nextjs` dependency | Installed, never wired (no `Sentry.init`, no config) | — | Hygiene | Wire it or remove it (ponytail: dead dependency). |

---

## Code Bugs Confirmed From Source (highest value of this pass)

- **X1 — Penalty double-insert on republish (Blocker, data integrity).** [`publish-service.ts:313`](../src/lib/results/publish-service.ts) writes penalties with a plain `.insert()` and no preceding delete, while race results (upsert) and reserve assignments (delete-then-insert, three lines above) are both idempotent. Round 3's republish/correction feature (M9) made double-publish a real user action; every correction of a session carrying penalties re-inserts those rows, double-counting penalty points → wrong ban thresholds and wrong standings. **Fix:** delete penalties for the session before inserting, matching the reserve block.
- **X2 — Round-number collision (Major).** Regression from round 3's "Round N ·" prefix colliding with league-authored session names. (= R2.)
- **X3 — Publish-error misdirection (Major).** Regression from round 2's `N5(c)` object-render crash fix, which coerced to a fixed, misleading message. (= M1.)

---

## Cross-Cutting Patterns

1. **The publish flow has the thinnest edge/error handling of any surface** — flagged independently by the E2E designer (penalty-insert non-idempotency, X1) and the microcopy agent (error misdirection, M1/X3). The highest-stakes, highest-frequency admin flow is where correctness handling is weakest, precisely because rounds 1–3 kept extending it (correction mode, republish) without hardening its write idempotency and error surfacing.
2. **Post-mutation focus continuity is a systemic gap** (K1/K2/K4). Rounds 1–3 added `role="status"`/`aria-live` announcements for every async action — but the keyboard caret was never moved to match. The information reaches a screen-reader; the keyboard user lands on `<body>`. One shared "focus the new region" helper closes all of them.
3. **Two of three code bugs are prior-audit regressions** (X2, X3). Rapid consistency/robustness fixes across rounds 1–3 introduced collisions with existing data and error paths. Argues for the E2E scoring suite (E1–E5) as a regression backstop before the next round of changes.
4. **Three agents independently hit the empty-`race_results` reality** (racer R1, E2E "decisive seed fact", keyboard mutation observations). Whatever the seed's cause, the product must degrade gracefully when standings exist without finishing orders — because workbook import produces exactly that shape.

---

## Recommended Fix Order

1. **X1 — penalty double-insert** (one-line delete-then-insert). Confirmed data corruption in the core flow; smallest possible diff. Do first.
2. **R1 — results dead-end fallback.** The most common weekly racer task is broken on every completed race; also the honest handling of real imported data.
3. **X2/R2 — round-number collision** and **X3/M1 — publish-error surfacing.** Two verified regressions, both high-frequency (public every race; admin every failed publish), both small.
4. **R3 + R4 — hub burial + informal Wheel tab.** High-frequency public confusion; each a small, localized change.
5. **E1–E5 — scoring/role E2E suite.** ~23 tests, ~74s; the regression backstop that would have caught X1–X3. Includes the role-escalation Blockers.
6. **K1/K2 — post-mutation focus** (shared helper) and **B1–B3 — tap targets** (three class-level edits). Broad accessibility wins for little code.
7. **M2–M4 — same-screen microcopy** (Tier 1 only). Then the repo-wide hygiene sweep (M5/M6) opportunistically.
8. **P4 — decide on the unused Sentry dependency.** Hygiene, not urgent.

_Deferred/declined with reason: performance optimization (public healthy, admin bundles irrelevant — P2/P3); empty-homepage E2E (fixture cost > risk); workbook-import E2E (unit-covered, high fixture cost); the four "not a violation" microcopy clusters._

---

## What Is Already Working Well

- **Public performance is healthy** under throttling harsher than real usage — no engineering time warranted (P1).
- **Tablet/iPad layout is structurally sound** — zero overflow, tables contained, no truncation across 75 page-views (breakpoint pass).
- **Dark-theme focus indicators are consistently visible** — the brief's worry was refuted by screenshot. Skip links, number-input arrow-keys, and the live filter are all keyboard-clean (keyboard pass).
- **Prior audit scaffolding holds up**: standings search, calendar mobile cards, min-h-11 sub-nav, penalty-total consistency, grid-order prefill, live publish validation, `aria-live` announcements — all confirmed still working.
- **Copy register is right where it counts**: the penalties page reads as neutral race-control record, not public shaming; the context strip orients on every page; login errors correctly avoid revealing which credential was wrong.
- **Rounds 1–3 genuinely closed their scope** — this pass had to reach into edge cases, focus continuity, and data-shape robustness to find what remained, which is where a fourth audit _should_ be finding things.

---

## Environment Caveats (not counted as findings)

- The keyboard agent observed HTTP 500 on write endpoints in the manually-started `npm run start` server, which forced three post-success states to be source-inferred. This is **most likely a missing runtime env var** in the manual start (e.g. `CSRF_SECRET` via `readServerEnv()` throwing → caught as a generic 500), not a product defect: the 19/19 E2E suite exercises these same writes successfully under the test harness. Flagged for confirmation.
- Lighthouse could not run locally (renderer `TARGET_CRASHED` across four launch strategies); field vitals were captured via Playwright + CDP throttling instead. The Lighthouse composite score is unmeasured — cheapest closure is PageSpeed Insights against the deployed URL, judged optional since field vitals already pass with margin.
