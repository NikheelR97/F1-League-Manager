# F1 Esports League Manager - Simple Developer Handover

**Status:** S9 spreadsheet import complete on `feature/s9-spreadsheet-import`; next sprint is S10 regression and security audit.
**Audience:** Interns, juniors, and any developer joining the project.
**Goal:** Build a fast, secure, modern F1 esports league app that replaces the current spreadsheet workflow.

---

## Current Handover Notes

Last updated: May 12, 2026.

Current branch state:

| Item | Current state |
|------|---------------|
| Active development branch | `feature/s9-spreadsheet-import` — S9 complete, pending PR to `dev`. |
| Latest merged PR | PR #13, `feat(s8): admin operations — seasons, carry-overs, user roles, audit log` on `dev` |
| Merge commit | `cad0341` |
| Local Supabase target | Docker local project at `http://127.0.0.1:54321` |
| Latest migration applied locally | `20260512000000_s8_admin_operations.sql` (S9 migration `20260513000000_s9_workbook_import.sql` must be applied before testing import) |

S9 adds workbook import — a two-phase import pipeline for the Season 2 `.xlsx` workbook:

1. Admin uploads a workbook at `/admin/import`. The upload route parses the file, imports all data, calculates standings server-side, and returns a diff comparing app standings to workbook-stated standings. Raw workbook rows are never sent to the browser.
2. Admin reviews the diff report. Confirmation is blocked unless `diff.clean === true`.
3. On confirmation, the migration record is locked (`status = 'confirmed'`). Re-upload for the same season is rejected with 409.
4. Sessions are upserted by a deterministic `session_code` (`IMP001`–`IMP024`) — safe to re-upload before confirmation.
5. Transfer-aware team resolution: each race result resolves the correct team using `transferAfterRace` from the League Management sheet.
6. All routes use `withAdminGuard`; the upload route passes `maxBodyBytes: MAX_WORKBOOK_BYTES` to allow 10 MB workbooks through the guard's default 50 KB body limit.

Important S9 rules:

```text
- Only .xlsx files are accepted; extension is checked on the server.
- MAX_WORKBOOK_BYTES = 10 MB; MAX_WORKBOOK_DRIVERS = 60; MAX_WORKBOOK_RACES = 30.
- XLSX is read with type:"buffer" to read cached cell values, not formulas.
- Points are calculated server-side (calculateRacePoints); workbook formula results are ignored for standings.
- One confirmed migration per (league_id, season_id) — upload returns 409 if a confirmed migration exists.
- Confirm route validates migration_id as UUID and rejects already-confirmed migrations with 409.
- Both routes write audit logs: import.uploaded and import.confirmed.
- workbook_migrations stores only metadata + diff; raw parsed rows are discarded after import.
```

S9 migration:

```text
supabase/migrations/20260513000000_s9_workbook_import.sql
```

This migration adds a unique constraint on `race_sessions(league_id, season_id, session_code)` for idempotent upserts, and an index on `workbook_migrations(league_id, season_id, status)` for fast lock checks.

S9 validation evidence:

```powershell
npm run type-check
npm run lint
npm run test          # 313 tests (18 test files)
npm run build
npm run sprint-verify # all gates pass including E2E
```

Known deferred S9 items:

| Item | Reason |
|------|--------|
| `driver_penalty_totals` not rebuilt on import | Import flow has no threshold configuration data. Carry-over penalties from the League Management sheet populate `carry_over_penalty_points` on `league_driver_entries` but do not populate `driver_penalty_totals`. Run carry-over via the S8 carry-over API after import. |
| Real workbook end-to-end smoke | Requires local Supabase with a seeded league + season; the import logic is unit-tested structurally. |

---

### S8 Notes (archived)

S8 adds admin operations — seasons management, carry-over of penalties and bans, super-admin user role management, and the audit log viewer:

1. Seasons can be marked as current (clears the flag from all others) or archived (togglable). The current season cannot be archived.
2. An archived season cannot be made current.
3. Carry-over: copies each driver's end-of-season `penalty_points` and `ban_threshold_reached` flag from `driver_penalty_totals` into `carry_over_penalty_points` and `carry_over_ban_count` on new `league_driver_entries`. Safe to re-run (upsert).
4. Super-admin user management: super_admins can promote or demote other users' roles. Normal admins cannot access this page or API. A super_admin cannot change their own role.
5. Audit log viewer: server-rendered table at `/admin/audit` with filters for actor, action, entity type, entity ID (pass a league or season UUID to scope by league/season), and date range. Append-only — no update or delete policies exist on `audit_logs`. All search params are validated with Zod before reaching the DB.
6. Admin nav gains "Audit Log" for all admins and "User Roles" for super_admins only.
7. Season selector on the league admin detail page (`/admin/leagues/[id]`): a `?season_id=` URL param (Zod-validated UUID) switches the season context; `race_sessions` and `league_driver_entries` are filtered by the chosen season. Defaults to the current season, then the league's own initial season. The selector is hidden when only one season exists.

Important S8 rules:

```text
- Only super_admin may call GET /api/admin/users or PATCH /api/admin/users/[id]/role.
- A super_admin cannot change their own role (prevents accidental self-lockout).
- Cannot mark an archived season as current.
- Cannot archive the current season.
- Carry-over upserts on (league_id, season_id, driver_id) — safe to re-run.
- audit_logs has no update or delete RLS policies — append-only by design.
- The Discord webhook env var (DISCORD_WEBHOOK_URL) is present in env.ts and .env.example but no webhook sending is implemented yet.
```

S8 migration: `supabase/migrations/20260512000000_s8_admin_operations.sql`

Known S8 accepted risks:

| Risk | Detail |
|------|--------|
| `season.set_current` atomicity | Two sequential writes: set target → clear others. If the clear step fails the desired season is already current (better than zero current seasons), but stale `is_current = true` rows may remain until the next successful call. Wrap in a DB function/RPC if this becomes a concern. |

---

### S7 Notes (archived)

S7 adds the racer garage - private vehicle setup management for authenticated racers:

1. Racers can create, edit, delete, and duplicate vehicle setups per circuit.
2. Setup list never exposes setup_data (compact DTOs only).
3. All racer routes follow the HANDOVER section 7 security pipeline: size -> origin -> session -> CSRF.
4. Ownership is verified server-side (profile_id check via service role client); RLS enforces it at DB level too.
5. Setups are private by default; duplicates always start private.
6. Filters: circuit, weather, and league (league_id added to vehicle_setups via S7 migration).

Important S7 racer garage rules:

```text
- Never load setup_data in the list query - it can be large JSON; load it only on edit.
- Verify driver ownership with a service role SELECT before any mutation (not just RLS).
- Return 404 (not 403) when a setup is not found or not owned - avoids leaking existence.
- Duplicate always sets is_public = false regardless of source setup visibility.
- The racer guard checks session (any authenticated user) - no admin role required.
```

S7 migrations:

```text
supabase/migrations/20260509120000_s7_vehicle_setups_league.sql
supabase/migrations/20260509130000_fix_driver_standings_team_id.sql
```

The first migration adds `league_id uuid` (nullable) to `vehicle_setups` for filtering setups by league, plus an index on `(driver_id, league_id)`. The second migration adds `team_id` to `driver_standings` so public standings can show current team context after seeded data or recalculation.

S7 validation evidence:

```powershell
npm.cmd run type-check
npm.cmd run lint
npm.cmd run test          # 227 tests
npm.cmd run build
npm.cmd run sprint-verify # all gates pass including E2E
npm.cmd run deploy:check  # passed after Next 16.2.6 security patch
```

PR #11 CI verification passed after the Next.js security update to `next@16.2.6` and `eslint-config-next@16.2.6`.

Known deferred S8 items:

None — all build steps completed.

Known S8 accepted risks:

| Risk | Detail |
|------|--------|
| `season.set_current` atomicity | Two sequential writes: set target → clear others. If the clear step fails the desired season is already current (better than zero current seasons), but stale `is_current = true` rows may remain on other seasons until the next successful call. Wrap in a DB function/RPC if this becomes a concern. |

---

### S7 Notes (archived)

Known deferred S7 items:

| Item | Status | Note |
|------|--------|------|
| "Copy from circuit" create-form shortcut | Deferred | Racers can duplicate manually; a dedicated copy-from selector can be added later. |
| Game version autocomplete | Deferred | Free text input works; autocomplete from existing values can be added later. |
| Public setup discovery | Deferred | `is_public` flag exists; a public setup gallery page is not yet built. |
| Racer E2E auth tests | Deferred | Browser E2E for authenticated racer flow deferred with other auth E2E expansion. |

---

### S6 Notes (archived)

S6 added the calendar and digital wheel workflow:

1. Admins can create, edit, and manage race sessions on the calendar.
2. Public users can view scheduled and completed sessions through league-safe public routes.
3. Admins can spin a digital circuit wheel for scheduled sessions.
4. Wheel confirmation is server-side and atomic, so the selected circuit is persisted consistently.
5. Public wheel history avoids leaking admin profile details.

Important S6 calendar and wheel rules:

```text
- The wheel animation is visual only; the server-confirmed result is the source of truth.
- Wheel confirmation must use public.confirm_wheel_spin_session(...) rather than client-only updates.
- Public calendar reads should stay limited to scheduled/completed sessions.
- Session create/update must validate the selected points system belongs to the same league.
- The S6 migration must be applied to whichever database target is used for validation.
```

S6 migration:

```text
supabase/migrations/20260509101500_s6_confirm_wheel_spin_session.sql
```

This migration creates the `public.confirm_wheel_spin_session(...)` RPC used to atomically confirm wheel selections.

S6 validation evidence:

```powershell
npm.cmd run type-check
npm.cmd run lint
npm.cmd run test          # 181 tests
npm.cmd run build
git diff --check
```

All passed before PR #10 was merged. PR #10 CI verification also passed.

Shared environment reminder:

Apply the S6 migration to any shared dev preview, staging, or production database before validating calendar and wheel behavior there. It has already been applied to the local Supabase Docker target.

Known deferred S6 items:

| Item | Status | Note |
|------|--------|------|
| Rich wheel animation polish | Deferred | Current wheel flow is functional; deeper animation polish can happen later. |
| Public race reports page | Deferred | Still depends on a dedicated reports experience. |
| Historical season selector | Deferred | MVP still assumes the active league season for primary public flows. |
| Full browser E2E for authenticated wheel flow | Deferred | Unit/integration coverage exists; browser coverage can be added when auth E2E helpers are expanded. |

---

### S5 Notes (archived)

S5 added the admin result publishing workflow:

1. Session management API (`GET + POST /api/admin/leagues/[id]/sessions`).
2. Session creation UI (`SessionForm.tsx` + `/admin/leagues/[id]/sessions/new`).
3. Publish API (`POST /api/admin/sessions/[id]/publish`) — Zod-validated; `points_awarded` absent from schema, server-calculated only.
4. Server-authoritative points engine (`src/lib/results/points.ts`) — FL bonus, pole bonus, non-classified → 0.
5. Workbook gap parser (`src/lib/results/parse-gap.ts`) — all HANDOVER §11 formats.
6. Standings builders (`src/lib/results/standings.ts`) — driver/team/penalty, tie-break order, carry-over.
7. Publish service (`src/lib/results/publish-service.ts`) — full publish pipeline with standings rebuild.
8. 4-step result entry stepper (`ResultStepper.tsx`) — qualifying → results → penalties → review → publish.
9. 167 unit/component tests passing (167 from 5 prior — 5 new `validatePublishResults` tests added in post-review fix commit).

Important S5 publish pipeline rules:

```text
- points_awarded is calculated server-side only. The API schema has no points_awarded field.
- penalty_points (discipline) do NOT affect standings. manual_points_adjustment DOES.
- Constructor standings use points_awarded only, not manual_points_adjustment.
- Standings are recalculated by full delete + re-insert to avoid unique position constraint violations.
- Standings recalculation runs BEFORE marking the session completed so a DB failure is safely retryable.
- Rescinded penalties are excluded from ban-total calculations (.neq("status", "rescinded")).
- Server validates cross-field rules: ≥1 classified finisher, no duplicate positions, ≤1 fastest-lap driver.
```

Post-review fixes applied (in commit `4e67fbd`, merged in PR #9):

| Bug | Fix |
|-----|-----|
| Session marked completed before standings recalc — failure left broken unretryable state | Moved standings recalc before `status = completed`; passes `additionalSessionId` so current session results are included |
| Rescinded penalties counted toward `ban_threshold_reached` | Added `.neq("status", "rescinded")` to penalties query in `recalculateStandings` |
| `penaltyMap` kept only last penalty per driver — multi-penalty ban alert wrong | Replaced with point aggregation loop across all non-rescinded penalties per driver |
| No server-side cross-field validation — duplicate positions/multiple FL could reach DB | Added `validatePublishResults()` pure function called before any DB write; exported + 5 unit tests |
| Index keys on removable penalty list items — stale React DOM on removal | Added stable `id: crypto.randomUUID()` to `PenaltyRow`; penalty items key on `row.id` |

No new migrations in S5. The existing schema (including `race_results`, `qualifying_results`, `penalties`, `driver_standings`, `team_standings`, `driver_penalty_totals`) was defined in the S1 migration.

S5 validation evidence:

```bash
npm.cmd run type-check
npm.cmd run lint
npm.cmd run test          # 167 tests
npm.cmd run test:coverage # branches 82.9%, all thresholds met
npm.cmd run build
npm.cmd run test:e2e
```

All passed before PR #9 was merged. CI green on both the initial S5 commit and the post-review fix commit.

Known deferred S5 items:

| Item | Status | Next action |
|------|--------|-------------|
| Standalone qualifying results page | Deferred | Qualifying shown on race detail; standalone page still deferred after S6. |
| Race reports page | Deferred | Needs a dedicated public reports experience; still deferred after S6. |
| Season selector on public pages | Deferred | MVP assumes one active season per league; revisit with historical seasons. |
| Cache/revalidation after publish | Deferred | Public pages use `force-dynamic`; tag-based revalidation still deferred after S6. |
| Standings atomicity (delete+insert gap) | Accepted risk | PostgREST has no transactions; gap is milliseconds during a rare admin action. Wrap in a DB function/RPC if standings become high-traffic. |

---

### S4 Notes (archived)

S4 added public league pages: league hub, driver standings, constructor standings, results list, race result detail, penalties, driver profiles, team profiles, and statistics.

The S4 hardening migration (`20260508123000_s4_public_security_boundaries.sql`) scopes public RLS policies to non-draft leagues, restricts result reads to completed sessions, and removes `steward_notes`/`appeal_notes` from the anon column grant on the penalties table.

All S4 validation passed before PR #8 was merged. Unit/component tests were at 105 passing after S4 review fixes.

---

## 1. What We Are Building

We are building a web app for managing F1 esports leagues.

The app must support:

| Feature | What it means |
|---------|---------------|
| Public league pages | Anyone can view standings, results, calendars, penalties, wheel history, race reports, drivers, and teams. |
| Admin panel | Admins manage leagues, teams, drivers, transfers, results, penalties, wheel spins, calendars, and seasons. |
| Racer accounts | Racers can log in and manage private vehicle setups. |
| Constructors championship | Teams score points as well as drivers. |
| Historical seasons | Seasons are separate. Old results stay available. |
| Spreadsheet migration | Current Season 2 data comes from `4QM8 F1 2025 Season 2.xlsx`. |
| Digital wheel | Standard League uses a server-confirmed wheel to choose circuits. |
| League branding | Admins can upload league logos, hero images, team logos, and team car images per league. |

The app must replace this workbook:

```text
c:\Users\rajma\OneDrive\F1 2025\4QM8 F1 2025 Season 2.xlsx
```

The spreadsheet is the source data for the first migration. After the migration is confirmed, the app becomes the source of truth.

---

## 2. Locked Decisions

These decisions are confirmed and should not be changed without updating this document first.

| Area | Decision |
|------|----------|
| Hosting | Vercel plus Supabase free tier. |
| Expected users | Under 50 concurrent viewers on race night. |
| Admin roles | One super admin, many normal admins. |
| Team setup | Admin can use official F1 teams or custom teams when creating a league. |
| Team size | Two main drivers per team. |
| Reserves | Admin manually assigns reserve drivers for a race. |
| Cross-league drivers | A driver can race in more than one league. |
| Transfers | Drivers can leave, rejoin, and change teams mid-season. |
| Points | Standard F1 points by default, but custom points per league are allowed. |
| Sprint points | Sprint sessions have their own points system. |
| Fastest lap/pole | Can be enabled or disabled per league and race format. |
| Penalty points | Discipline only. They do not change championship points automatically. |
| Ban thresholds | Thresholds show alerts only. Admins manually decide and record bans. |
| Championship penalties | Use manual championship point adjustments. These do affect standings. |
| Appeals/stewards | Handled manually outside the app. App stores notes/status for audit. |
| Discord | Stretch goal, not MVP. |
| Brand assets | Uploaded per league/team. No official F1 logos unless licensed. |

---

## Branch And Environment Model

This project uses three long-lived GitHub branches and two cloud Supabase projects.

Daily local development should use local Supabase when possible. Shared integration and staging testing use the non-production Supabase project. Production uses its own isolated Supabase project.

| GitHub branch | Supabase target | Vercel target | Purpose |
|---------------|-----------------|---------------|---------|
| `dev` | Local Supabase by default. Dev previews may use `f1-league-manager-nonprod`. | Development/preview | Daily development and disposable integration testing. |
| `staging` | `f1-league-manager-nonprod` | Staging/preview | Release candidate testing before production. |
| `prod` | `f1-league-manager-prod` | Production | Real league data and public release. |

Standing rules:

1. Normal local work happens on `dev` using local Supabase.
2. Shared dev previews and release testing use `f1-league-manager-nonprod`.
3. Production deploys happen from `prod` using `f1-league-manager-prod`.
4. Never put production Supabase keys in dev or staging environments.
5. Never point local development at production unless a senior approves a controlled smoke test.
6. Before running migrations, confirm the current Git branch and Supabase target match.
7. Before deployment, confirm Vercel environment variables match the branch target.
8. Non-production data may be reset; production data must never be reset.

Every developer and AI assistant must keep this mapping in mind when making code, docs, migration, or deployment changes.

---

## Pull Request And Review Model

All project work must happen through branches and pull requests. Do not commit directly to `dev`, `staging`, or `prod`.

Branch flow:

| Work type | Work branch | Pull request target | Required review |
|-----------|-------------|---------------------|-----------------|
| Normal feature or bug fix | `feature/short-description` or `fix/short-description` from `dev` | `dev` | Code review expected, but GitHub does not currently enforce approval on `dev`. |
| Release candidate | `release/yyyy-mm-dd` from `dev` | `staging` | Code review plus QA checklist. |
| Production release | `promote/yyyy-mm-dd` from `staging` | `prod` | Senior review, security check, deploy checklist. |
| Hotfix | `hotfix/short-description` from `prod` | `prod`, then back-merge to `staging` and `dev` | Senior review. |

Pull request rules:

1. Every code change must have a PR.
2. Every PR must describe what changed, why it changed, and how it was tested.
3. Every PR must pass CI before merge.
4. Every PR touching auth, RLS, migrations, secrets, deploy config, or production data needs senior review.
5. PRs into `prod` must be small, already tested on `staging`, and linked to release notes.
6. `dev` PRs may be owner-merged after CI and documented Codex review when no second reviewer is available.
7. Squash merge is preferred for feature branches unless a senior chooses otherwise.
8. After hotfixes, back-merge into `staging` and `dev` so branches do not drift.

AI assistant rule:

```text
When working on code, Codex must ask or confirm the intended branch and PR target before making changes that are meant to be merged.
```

---

## Sprint Tracking Model

As sprints are worked, the docs must show what is done, what is still outstanding, and why.

Use this status model:

| Status | Meaning |
|--------|---------|
| `Not started` | Work has not begun. |
| `In progress` | Work has started but is not complete. |
| `Done` | Work is complete, tested, reviewed, and accepted. |
| `Outstanding` | Work is not complete and must include a reason. |
| `Blocked` | Work cannot continue until something external changes. |

Tracking rules:

1. Every sprint task must have a status.
2. Every `Done` task must include evidence, such as PR number, test command, screenshot, or migration name.
3. Every `Outstanding` task must include a reason.
4. Every `Blocked` task must include the blocker owner or next action.
5. Sprint reviews must update the sprint plan before moving to the next sprint.
6. Do not mark a feature `Done` just because code exists. It must pass tests and review.

Use this simple format when updating sprint progress:

| Task | Status | Evidence | Outstanding reason / next action |
|------|--------|----------|----------------------------------|
| Example task | Done | PR #12, `npm run test` | None |
| Example task | Outstanding | None | Waiting for Supabase keys |

---

## 3. User Roles

| Role | Can do |
|------|--------|
| Public visitor | View public league information. No login needed. |
| Racer | View public pages plus manage own setup garage. |
| Admin | Manage league operations. Cannot manage other admins. |
| Super admin | Everything admin can do plus manage admin users and global audit logs. |

Important security rule:

```text
Never trust a role sent from the browser.
Always read the user's role from the profiles table on the server.
```

---

## 4. Tech Stack

| Layer | Tool |
|-------|------|
| Framework | Next.js App Router |
| Language | TypeScript strict mode |
| Styling | Tailwind CSS |
| UI primitives | shadcn/ui where useful |
| Icons | lucide-react |
| Fonts | Titillium Web and JetBrains Mono |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Validation | Zod |
| Forms | React Hook Form |
| Unit tests | Vitest |
| Component tests | React Testing Library |
| E2E tests | Playwright |
| API tests | Route tests or Supertest-style tests |
| Rate limiting | Upstash Redis |
| Monitoring | Sentry |
| Deployment | Vercel |

Use official docs during implementation to confirm exact APIs and package versions.

---

## 5. UI And UX Direction

The app should feel like a modern F1 race-control product:

| Requirement | Notes |
|-------------|-------|
| Style | Dark, sharp, premium, data-rich, fast. |
| Not allowed | Do not copy official F1 logos, protected broadcast graphics, or unlicensed assets. |
| Public theme | "Race Weekend" theme: dark graphite, red accents, white/silver data, team-color chips. |
| Admin theme | "Race Control" theme: dense, clear, operational, fewer decorations. |
| Racer theme | "Driver Garage" theme: focused setup management with tags and quick duplication. |
| Headings/body font | Titillium Web. |
| Numbers/time/points | JetBrains Mono. |
| Mobile tables | Use cards or expandable rows, not squeezed wide tables. |

The league hub should be the main public page for a league.

It should show:

1. Next race.
2. Latest result.
3. Top 5 drivers.
4. Top 5 constructors.
5. Active bans and penalty threshold alerts.
6. Wheel status if the league uses the wheel.

Every public results/standings page must show:

1. League.
2. Season.
3. Last published round.
4. Race format.
5. Last updated time.

---

## 6. Performance Rules

The app must not feel slow or spreadsheet-like.

Simple rules:

| Rule | What to do |
|------|------------|
| Server-render public pages | Public pages should show useful content before realtime or polling starts. |
| Use compact DTOs | Do not send raw database joins or huge objects to the browser. |
| Avoid `select('*')` | Select only the fields needed. |
| Bound every list | Every list query needs a limit. |
| Use standings snapshots | Public standings read from precomputed standings tables. Do not recalculate standings on every page view. |
| Avoid N+1 fetches | Do not fetch row-by-row in React components. |
| Optimize images | Use `next/image` or Supabase image transformations with fixed dimensions. |
| Keep client JS small | Use client components only when interactivity is needed. |
| Pause polling | Polling must pause when the browser tab is hidden. |

Performance targets:

| Target | Goal |
|--------|------|
| Public LCP | Under 2.5s |
| CLS | Under 0.1 |
| INP | Under 200ms |
| Lighthouse Performance | 90 target, 85 minimum |
| Admin row edits | Feel under 100ms |

---

## 7. Security Rules

Security is part of every sprint.

Every admin/racer API route must follow this order:

```text
check method
check content type and size
check origin
get session
read role from database
validate CSRF for writes
validate body with Zod
call service
write audit log if state changed
return sanitized response
```

Never do these:

| Do not | Why |
|--------|-----|
| Do not expose service role key to client | It bypasses RLS. |
| Do not trust browser role values | They can be forged. |
| Do not accept points from client | Server must calculate points. |
| Do not accept wheel result from client | Server confirms the wheel result. |
| Do not return raw stack traces | They leak internals. |
| Do not parse large uploads blindly | Workbook upload must be capped. |
| Do not store secrets in audit logs | Audit metadata must be bounded and safe. |

Required security controls:

| Control | Requirement |
|---------|-------------|
| RLS | Enabled on every table. |
| Auth | Supabase Auth. |
| Admin authorization | Check `profiles.role` on every admin request. |
| Racer authorization | Owner checks in RLS and server service. |
| CSRF | Required for all state-changing routes. |
| Rate limiting | Required for auth and admin APIs. |
| Error handling | Generic in production, details only in Sentry. |
| Secret scan | Run in CI/deploy checks. |
| Dependency audit | No high/critical vulnerabilities before deploy. |

---

## 8. Main Business Workflows

### 8.1 League Creation

Admin steps:

1. Choose season.
2. Enter league name and slug.
3. Choose manual calendar or wheel calendar.
4. Choose official team preset or custom teams.
5. Configure points systems.
6. Configure fastest lap and pole bonuses.
7. Configure penalty threshold visibility.
8. Upload optional league/team brand assets.
9. Add teams, drivers, and reserves.
10. Add calendar and wheel pool if needed.
11. Activate league only after validation passes.

### 8.2 Result Publishing

Do not build one huge spreadsheet form. Use a stepper:

```text
Session -> Qualifying -> Race Results -> Penalties/Bans -> Review & Publish
```

The review step must show:

1. Finish order.
2. Points.
3. Fastest lap.
4. Pole bonus.
5. Manual championship adjustments.
6. Penalty points.
7. Ban alerts.
8. Standings impact.

Important:

```text
Publish is only allowed after the review step passes validation.
```

### 8.3 Transfers

Drivers can leave, rejoin, and change teams.

Admin transfer steps:

1. Select league and season.
2. Select driver.
3. Confirm previous team.
4. Select last completed race for the old team.
5. Select new team and slot, or mark driver as leaving.
6. Review the stint timeline.
7. Confirm transfer.

Example timeline:

```text
Ferrari R1-R8 -> Alpine R9-R15 -> Free Agent -> Haas R18+
```

Important:

```text
Old results keep the team recorded at race time.
Transfers must not rewrite old result rows.
```

### 8.4 Penalties And Bans

Penalty points are discipline tracking only.

They do:

1. Show driver discipline history.
2. Trigger warning alerts near thresholds.
3. Help admins manually decide bans.

They do not:

1. Automatically deduct championship points.
2. Automatically ban a driver.

Championship point penalties use manual championship adjustments.

### 8.5 Manual Championship Adjustments

Manual championship adjustments affect standings.

Use them for:

1. Championship point penalties.
2. Manual corrections.
3. Special league decisions.

Every adjustment must have:

1. Driver or team.
2. Points delta.
3. Reason.
4. Admin actor.
5. Audit log entry.

### 8.6 Wheel Spin

The wheel animation is only visual.

The authoritative result must come from the server.

Flow:

1. Admin loads eligible circuits.
2. Admin starts wheel animation.
3. Server selects/records candidate.
4. Admin confirms.
5. Server creates race session.
6. Circuit is removed from eligible pool.
7. Public wheel history updates.

### 8.7 Racer Garage

Racer setup garage requirements:

1. Private by default.
2. Owner-only access.
3. Create setup.
4. Edit setup.
5. Duplicate setup.
6. Copy setup from another circuit.
7. Filter by circuit, game version, weather, league.

Do not load full setup JSON for every row in the garage list.

---

## 9. Database Model

This is the simplified table list. Developers should create migrations from this list.

| Table | Purpose |
|-------|---------|
| `profiles` | Supabase user profile and role. |
| `seasons` | Season records. |
| `leagues` | League config and branding. |
| `points_systems` | GP/Sprint/custom points. |
| `official_team_templates` | Seeded official F1 team options. |
| `teams` | Teams per league with optional assets. |
| `drivers` | Driver identities. |
| `league_driver_entries` | Driver participation in a league season plus carry-over penalties/bans. |
| `driver_team_stints` | Team history over time. |
| `race_reserve_assignments` | Reserve driver assignment per race. |
| `circuits` | Track library. |
| `league_circuit_pools` | Wheel-eligible circuits. |
| `race_sessions` | Calendar/race sessions. |
| `wheel_spins` | Wheel spin history. |
| `qualifying_results` | Qualifying results. |
| `race_results` | Race result rows, calculated points, penalties, manual adjustments. |
| `penalties` | Discipline records and steward/appeal audit fields. |
| `championship_adjustments` | Manual point adjustments that affect standings. |
| `driver_penalty_totals` | Precomputed penalty totals and ban alert status. |
| `driver_standings` | Precomputed driver standings. |
| `team_standings` | Precomputed constructor standings. |
| `vehicle_setups` | Racer setup garage. |
| `audit_logs` | Append-only audit history. |
| `workbook_migrations` | Spreadsheet import and confirmation lock. |

Storage buckets:

| Bucket | Purpose |
|--------|---------|
| `league-assets` | League logos and hero images. |
| `team-assets` | Team logos and car images. |

---

## 10. Important Data Rules

| Rule | Why |
|------|-----|
| `points_awarded` is server-calculated | Prevents forged points. |
| Old result `team_id` is never rewritten | Preserves constructor history. |
| Reserve driver gets personal points | Reserve appearances count personally. |
| Reserve constructor points go to `reserve_team_id` | Points go to the team represented in that race. |
| Penalty points do not alter standings | They are discipline-only. |
| Manual championship adjustments do alter standings | Used for championship penalties/corrections. |
| One confirmed workbook migration per season | Prevents accidental re-import. |
| Audit metadata is bounded | Prevents large or secret logs. |

---

## 11. Result Parsing Rules

The workbook uses text values for race results. The app must parse them consistently.

| Input | Meaning |
|-------|---------|
| `0` | Race leader. |
| `89.354` | Finished 89.354 seconds behind leader. |
| `93` | Finished 93 seconds behind leader. |
| `100` | Finished 100 seconds behind leader. |
| `DNF - 1` | First retirement. |
| `DNF - 2` | Second retirement. |
| `1 Lap - 1` | One lap down, first in that group. |
| `2 Laps - 2` | Two laps down, second in that group. |
| `BAN` | Banned. |
| `DSQ` | Disqualified. |
| blank | Did not participate. |

Sort order:

```text
finished -> lap down -> dnf -> dsq -> ban -> dnp
```

Fastest lap text like `1:13.653` belongs in the fastest lap field, not the time gap field.

---

## 12. Spreadsheet Migration

The migration imports the current Season 2 workbook.

Steps:

1. Upload `.xlsx` in admin import page.
2. Check file type and size before parsing.
3. Parse league settings.
4. Parse track list.
5. Parse drivers and teams.
6. Parse transfers.
7. Parse carry-over penalty points and unserved bans.
8. Parse qualifying and race results.
9. Parse manual championship adjustments.
10. Recalculate standings in the app.
11. Compare app standings to workbook standings.
12. Show a diff report.
13. Allow confirmation only when the diff is clean.
14. Lock the migration after confirmation.

Do not trust workbook formulas as final truth. Import raw entries and recalculate in the app.

---

## 13. Testing Requirements

Minimum test groups:

| Test group | Must cover |
|------------|------------|
| Points tests | GP points, Sprint points, custom points, fastest lap, pole, DNF, invalid positions. |
| Parser tests | All workbook result formats. |
| Standings tests | Driver standings, constructor standings, transfers, reserves, manual adjustments. |
| Penalty tests | Qualifying/race penalty totals, threshold alerts, manual bans, carry-over. |
| Wheel tests | Eligible pool, used circuit removal, server confirmation. |
| Transfer tests | Previous team, last completed race, leave/rejoin, history preserved. |
| Setup tests | Owner-only setup access and bounded JSON. |
| Asset tests | Upload file type, file size, path scoping. |
| Import tests | Workbook parsing, diff report, confirmation lock. |
| Security tests | 401, 403, CSRF, RLS, no secret leaks. |
| E2E tests | Public pages, admin result publish, wheel, transfer, import, racer garage. |

Every sprint must pass:

```bash
npm run sprint-verify
```

---

## 14. Environment Variables

Environment values must be different for local/dev, staging, and production.

| Context | Supabase values to use |
|---------|------------------------|
| Local `dev` work | Local Supabase values, or non-production values only when testing shared integrations. |
| `dev` Vercel preview | Non-production Supabase URL, public key, and secret key. |
| `staging` | Non-production Supabase URL, public key, and secret key. |
| `prod` | Production Supabase URL, public key, and secret key. |

| Variable | Scope | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Browser-safe Supabase key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Admin server operations. |
| `NEXT_PUBLIC_SITE_URL` | Public | Site URL. |
| `CSRF_SECRET` | Server only | CSRF signing. |
| `UPSTASH_REDIS_REST_URL` | Server only | Rate limiting. |
| `UPSTASH_REDIS_REST_TOKEN` | Server only | Rate limiting token. |
| `SENTRY_DSN` | Mixed | Error monitoring. |
| `SENTRY_AUTH_TOKEN` | Server/CI only | Sentry source maps. |
| `DISCORD_WEBHOOK_URL` | Server only | Stretch goal. |
| `SUPABASE_STORAGE_ASSET_BUCKET` | Config | Asset storage bucket. |
| `NODE_ENV` | Runtime | Environment mode. |

Never prefix server-only secrets with `NEXT_PUBLIC_`.

Never reuse production secrets in dev or staging.

---

## 15. Deployment

Target deployment:

| Part | Service |
|------|---------|
| App | Vercel |
| Database/Auth/Storage | Supabase |
| Rate limiting | Upstash |
| Monitoring | Sentry |

Branch deployment rule:

| Action | Branch | Supabase project |
|--------|--------|------------------|
| Local daily development | `dev` | Local Supabase |
| Shared dev preview | `dev` | `f1-league-manager-nonprod` |
| Release testing | `staging` | `f1-league-manager-nonprod` |
| Production release | `prod` | `f1-league-manager-prod` |

Before production:

1. `npm run sprint-verify`
2. `npm audit --audit-level=high`
3. Secret scan.
4. Confirm current branch is `prod`.
5. Confirm Vercel production branch is `prod`.
6. Confirm production env vars point to `f1-league-manager-prod`.
7. Production build.
8. E2E tests.
9. Manual smoke tests.

Production smoke tests:

1. Public standings load.
2. Public constructor standings load.
3. Public penalties load.
4. Public wheel history loads.
5. Login works.
6. Unauthenticated `/admin` redirects.
7. Admin can publish a result.
8. Standings update.
9. Racer can create private setup.
10. Another racer cannot read that setup.
11. No service role key appears in browser responses.

---

## 16. Definition Of Done

A feature is done only when:

1. It matches this handover.
2. TypeScript passes.
3. Lint passes with zero warnings.
4. Unit/component/API/E2E tests are updated.
5. Security negative tests exist for protected behavior.
6. Performance review is complete.
7. External inputs are validated with Zod.
8. Supabase errors are checked before data is used.
9. Admin state changes write audit logs.
10. No secrets leak to client code.
11. Branch and Supabase environment mapping is correct.
12. A PR exists with review notes and test evidence.
13. CI passes on the PR.
14. `npm run sprint-verify` passes.
