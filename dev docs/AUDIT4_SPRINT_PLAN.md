# S13 — Post-Launch Hardening (Audit 4 Remediation)

**Status:** Not started.
**Source:** [AUDIT4_GAP_CLOSING_REPORT.md](./AUDIT4_GAP_CLOSING_REPORT.md) — every work package below cites the finding IDs it closes.
**Goal:** Close the gap-closing audit's findings in dependency order, one merged wave at a time, with the scoring pipeline finally covered by E2E.
**Execution model:** Tiered subagents (Haiku = mechanical/checklist, Sonnet = judgment), `/ponytail` for code restraint, `/impeccable` for UI, orchestrator audits each diff before the gate. Same cadence as audit rounds 1–3: dispatch a wave → orchestrator reviews → run gates → one PR per wave → merge to `dev`.

---

## 1. How To Use This Plan

Work wave by wave. Do not start Wave _n+1_ until Wave _n_ is merged to `dev` — later waves edit files earlier waves touch, and the E2E wave must assert **fixed** behaviour.

Per work package:
1. Read the scope and the finding IDs it closes (detail is in the audit report).
2. The subagent builds **only** the listed scope on the listed files (file ownership is exclusive within a wave).
3. Add the listed tests.
4. Orchestrator reviews the diff (ponytail over-engineering pass + impeccable detector on UI files).
5. Run the wave gate.
6. Update the tracker; open one PR for the wave.

**Hot files** (touched by more than one finding — assigned to exactly one owner per wave, never split mid-wave): `ResultStepper.tsx`, `publish-service.ts`, `results/[sessionId]/page.tsx`, `LeagueHub.tsx`, `AdjustmentDeleteButton.tsx`.

---

## 2. Tier Assignment Rubric

Same standard as the audit itself: **if a non-expert could verify the change against a fixed rule, it's Haiku; if it needs judgment about behaviour, copy, focus, or failure modes, it's Sonnet.** Do not over-assign Sonnet — a mechanical `min-h-11` sweep on Haiku is correct routing, not a shortcut.

---

## 3. Wave Gate

Every wave ends green on:

| Gate | Requirement |
|------|-------------|
| TypeScript | `npm run type-check` zero errors |
| Lint | `npm run lint` zero warnings |
| Unit/component | `npm run test` passes (+ new tests for changed logic) |
| Build | `npm run build` clean |
| E2E | `npm run test:e2e` passes |
| Full gate | `npm run sprint-verify` |
| Design | impeccable detector zero findings on changed UI files |
| Restraint | ponytail review of any security/data-path diff |

---

## 4. Wave 1 — Correctness & Data Integrity

### Goal

Fix the confirmed data-integrity bug and the two verified regressions, and stop the public results dead-end. All five packages own disjoint files and dispatch in parallel.

### Work Packages

| WP | Tier | Closes | Files (exclusive) | Scope |
|----|------|--------|-------------------|-------|
| **1.1** | **Sonnet** | X1 (Blocker) | `src/lib/results/publish-service.ts` | Make the penalty write idempotent on republish: delete this session's penalties before insert (mirror the reserve-assignment delete-then-insert three lines above). Verify recalculation still reads correct totals. |
| **1.2** | **Sonnet** | X3 / M1 (Major) | `src/components/admin/ResultStepper.tsx` (publish-error path only) | Parse the 422 `flatten().fieldErrors`/`formErrors` and render the first real field message; delete the misleading "check the review step" fallback. Keep the object-render crash guarded. |
| **1.3** | **Sonnet** | R1 (Blocker), R2/X2 (Major) | `src/app/leagues/[slug]/results/[sessionId]/page.tsx`, `.../qualifying/page.tsx`, `.../results/page.tsx`, `.../calendar/page.tsx` | R1: when a completed session has no `race_results`, render a standings-based fallback instead of "not available" (or gate the "View →" affordance on result presence). R2: stop prepending `Round ${circuit.round_number}` when `session.name` already begins "Round". |
| **1.4** | **Sonnet** | R3 (Major) | `src/components/league/LeagueHub.tsx` | Wrap "Last result" in a `Link`; add `formatDate(nextRace.scheduled_at)` to the Next Race card; guard the "Race ready" countdown against a past-dated scheduled race. |
| **1.5** | **Haiku** | R4 (Major) | `src/components/league/LeagueSubNav.tsx`, `src/app/leagues/[slug]/layout.tsx` | Thread `isWheelLeague` (same `format === "standard"` gate the hub uses) into the sub-nav; drop the Wheel tab when false. |

### Tests To Add

1. Penalty republish idempotency: publish a session with a penalty, republish, assert exactly one penalty row and unchanged penalty totals (WP1.1).
2. Publish 422 with a field error renders the field message, not the generic string (WP1.2).
3. Result detail with zero `race_results` renders the fallback, not the dead-end (WP1.3).
4. Round prefix not doubled when session name starts "Round" (WP1.3).
5. Sub-nav omits Wheel for a non-wheel league (WP1.5).

### Done When

1. Republishing a penalised session no longer double-counts. 2. Public results never dead-end on imported data. 3. "Round N · Round M" collision gone. 4. Hub links the last result and shows the next-race date. 5. Informal leagues show no Wheel tab. 6. Wave gate passes.

### Sprint Tracker

| Task | Status | Evidence | Outstanding / next action |
|------|--------|----------|---------------------------|
| WP1.1 penalty idempotency (X1) | Not started | | |
| WP1.2 publish-error surfacing (X3/M1) | Not started | | |
| WP1.3 results fallback + round fix (R1/R2) | Not started | | |
| WP1.4 hub weekly-checker fixes (R3) | Not started | | |
| WP1.5 informal wheel-tab gate (R4) | Not started | | |
| Wave 1 PR merged to `dev` | Not started | | |

---

## 5. Wave 2 — Accessibility & Microcopy

### Goal

Close the systemic post-mutation focus gap and the same-screen microcopy inconsistencies. Dispatch after Wave 1 merges (2.1 owns files Wave 1 edited).

### Work Packages

| WP | Tier | Closes | Files (exclusive) | Scope |
|----|------|--------|-------------------|-------|
| **2.1** | **Sonnet** | K1, K2, K3, K4; M2 | `ResultStepper.tsx`, `TransferForm.tsx`, `AdjustmentDeleteButton.tsx`, `WheelManager.tsx`, `LoginForm.tsx`, `PublicShell.tsx`, `AdminShell.tsx` | One shared "focus the new region" helper (`ref` + `tabIndex={-1}` + `.focus()`), applied at each mutation seam: publish-success banner, transfer stage swap, penalty/adjustment row delete, wheel reveal, login error, and `tabIndex={-1}` on `<main>`. Fold in M2 (AdjustmentDeleteButton delete/remove wording + missing recalc disclosure — same file). |
| **2.2** | **Haiku** | B1, B2, B3 | Shared nav/link/button classes + all `type="checkbox"` **except** in files 2.1 owns | `size-5` on native checkboxes; `min-h-11 inline-flex items-center` on public nav + table-cell link classes and the admin small-button class. **Do not touch** any file in WP2.1. |
| **2.3** | **Haiku** | M3, M4, M5, M6 | `PenaltyStatusEditor.tsx`, `AdjustmentForm.tsx`, `LeagueForm.tsx`, `SessionForm.tsx`, `SetupForm.tsx`, empty-state titles, error strings (excluding 2.1 files) | Apply the 10 house-style rules from the audit's microcopy-voice doc: reuse the public `STATUS_LABEL` map for the admin penalty dropdown; add a `KIND_OPTIONS` label map; errors no terminal period; labels sentence case; busy label = present participle of the button's verb; `…` not `...`; drop empty-state title-echoes. |

### Tests To Add

1. After publish success / row delete / stage swap, focus lands on a defined element, not `<body>` (2.1 — component test asserting `document.activeElement`).
2. Admin penalty dropdown renders mapped labels, not raw enums (2.3).
3. A representative form shows no-period errors and sentence-case labels (2.3).

### Done When

1. Every mutation seam moves the keyboard caret. 2. No sub-24px tap targets remain. 3. Same-screen microcopy is consistent per the house rules. 4. Wave gate passes.

### Sprint Tracker

| Task | Status | Evidence | Outstanding / next action |
|------|--------|----------|---------------------------|
| WP2.1 focus continuity + M2 (K1–K4) | Not started | | |
| WP2.2 tap targets (B1–B3) | Not started | | |
| WP2.3 microcopy house rules (M3–M6) | Not started | | |
| Wave 2 PR merged to `dev` | Not started | | |

---

## 6. Wave 3 — E2E Coverage & Hygiene

### Goal

Implement the designed scoring/role/lifecycle E2E suite (asserting the behaviour Waves 1–2 corrected) and settle the unused dependency. Runs last so tests assert fixed behaviour. Full design: audit `e2e-test-design.md` (~23 tests, ~74s budget, zero new global-setup seeding).

### Work Packages

| WP | Tier | Closes | Files (exclusive) | Scope |
|----|------|--------|-------------------|-------|
| **3.1** | **Sonnet** | E1, E2, E3 | `e2e/results-publish.spec.ts` (new), `e2e/auth-boundaries.spec.ts` (new) | Scoring pipeline with exact numeric assertions (publish → standings; republish → replace-not-double; concurrent double-publish invariant) + role escalation (RACER → admin UI + API blocked). Serial spec owns Informal; self-arranges via API. |
| **3.2** | **Sonnet** | E4, E5, E6; documents F1/F2 | `e2e/adjustments.spec.ts`, `e2e/lifecycle.spec.ts`, `e2e/public-pages.spec.ts` (new), extend `e2e/racer-garage.spec.ts` | Adjustment create/delete + delta validation; session delete recompute; transfer team-change; empty states / 404 / mobile calendar / result tabs; garage validation + duplicate. Fresh runId leagues, order-independent. F2 (transfer double-submit) test expected to fail — file it as a follow-up bug, don't force it green. |
| **3.3** | **Haiku** | P4 | `package.json`, config | Decide `@sentry/nextjs`: wire minimal init or remove the unused dep (ponytail: dead dependency). Default to remove unless the owner wants error tracking now. |

### Tests To Add

The suite **is** the deliverable — 3.1 + 3.2 add ~23 tests across the specs above. Keep total E2E runtime under the 90s ceiling.

### Done When

1. The scoring pipeline asserts real points on public pages. 2. Role-escalation boundaries are tested. 3. Lifecycle + empty-state + public interactions covered. 4. F2 documented as a tracked follow-up. 5. Sentry decision applied. 6. Wave gate passes (E2E under 90s).

### Sprint Tracker

| Task | Status | Evidence | Outstanding / next action |
|------|--------|----------|---------------------------|
| WP3.1 scoring + role E2E (E1–E3) | Done | `results-publish.spec.ts` (T1/T2/T3/T18/T19/T21), `auth-boundaries.spec.ts` (T7–T10); surfaced F6 | None |
| WP3.2 mutation + public E2E (E4–E6) | Done | `adjustments.spec.ts`, `lifecycle.spec.ts`, `public-pages.spec.ts`, extended `racer-garage.spec.ts`; confirmed F2 | None |
| WP3.3 Sentry dependency decision (P4) | Done | Removed `@sentry/nextjs` (unwired) + orphaned env fields; build clean | None |
| **F6 — position-swap republish 500 (new Blocker, found by T2)** | Fixed | `publish-service.ts` qualifying_results + race_results now delete-then-insert per session (unique(session,position) collided under row-by-row upsert); T2 un-fixme'd, unit guards added | None |
| F2 transfer double-submit follow-up filed | Filed | `lifecycle.spec.ts` T15 `test.fixme` documents it; fix needs a partial unique index on `driver_team_stints(league_driver_entry_id) WHERE ends_on IS NULL` (migration → senior review) | Open follow-up: migration + un-fixme T15 |
| CI runs only `smoke.spec.ts` for E2E | Noted | New specs validated locally on a clean DB (`supabase db reset` + `seed:e2e`); CI does not run them | Follow-up: wire authenticated E2E into CI (needs `E2E_SECRET` as a CI secret — owner/senior decision) |
| Wave 3 PR merged to `dev` | Not started | | |

---

## 7. Explicitly Deferred / Declined (with reason)

| Item | Finding | Reason |
|------|---------|--------|
| Public-page performance work | P1/P2/P3 | Public pages pass every field vital under harsher-than-real throttling; the 556KB baseline is framework floor (446KB real), not app-splittable. No engineering time warranted. |
| Position-delta "since last week" wiring | R6 | Needs real `previous_position` data, not code; revisit once R1 gives result pages real content. |
| Wheel explainer, garage cross-links, per-page titles | R5, R7, R8 | Minor/Polish; batch opportunistically, not worth a dedicated wave. |
| Workbook-import + empty-homepage E2E | E2E skips | High fixture cost, already unit-covered / low marginal risk. |
| The 4 "not a violation" microcopy clusters | V9/V10/V11/V14 | Real semantic distinctions (driver/racer, session/race, championship/standings, tone), not drift. |

---

## 8. Environment Note For Whoever Runs This

The audit was driven against a manual `npm run start` where write endpoints returned 500 — most likely a missing runtime env var (`CSRF_SECRET` via `readServerEnv()`), not a product defect (the E2E harness writes succeed). Before the Wave 3 E2E work, confirm the local `.env.local` has `CSRF_SECRET`, `E2E_SECRET`, and service-role vars so the seeded write path works. See [AUDIT4_GAP_CLOSING_REPORT.md](./AUDIT4_GAP_CLOSING_REPORT.md) §"Environment Caveats".
