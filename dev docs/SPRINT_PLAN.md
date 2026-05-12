# F1 Esports League Manager - Simple Sprint Plan

**Status:** S8 admin operations in progress on `feature/s8-admin-operations`; PR pending → `dev`.
**Audience:** Interns, juniors, and developers new to the project.
**Goal:** Build the app one safe sprint at a time, with tests proving each feature works before moving on.

---

## 1. How To Use This Plan

Work from top to bottom.

For every sprint:

1. Read the sprint goal.
2. Build only the listed scope.
3. Add the required tests.
4. Run the sprint gate.
5. Update the sprint tracker with done and outstanding work.
6. Ask for review before moving to the next sprint.

Do not skip a sprint. Later sprints depend on earlier database, security, UI, and testing foundations.

---

## 2. Main Commands

These commands must exist after setup.

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start local development server. |
| `npm run type-check` | Check TypeScript strict mode. |
| `npm run lint` | Check lint rules with zero warnings. |
| `npm run test` | Run unit and component tests. |
| `npm run test:coverage` | Run tests and coverage thresholds. |
| `npm run test:e2e` | Run Playwright E2E tests. |
| `npm run build` | Create production build. |
| `npm run sprint-verify` | Full sprint gate. |
| `npm run deploy:check` | Full deploy gate plus security audit. |

Every sprint ends with:

```bash
npm run sprint-verify
```

Before production:

```bash
npm run deploy:check
```

---

## 3. Rules For Junior Developers

Follow these rules every day.

1. Do not expose server secrets in client code.
2. Do not trust data sent by the browser.
3. Validate all external input with Zod.
4. Check every Supabase `.error` before using `.data`.
5. Keep API routes thin: validate, call service, return response.
6. Put business logic in service files, not React components.
7. Add tests for every feature and every bug fix.
8. Keep public pages fast by using server-rendered data and compact DTOs.
9. Do not change old migrations after they are reviewed.
10. Ask a senior before changing auth, RLS, points, standings, or migration rules.
11. Always confirm your Git branch before touching env vars, migrations, or deploy settings.
12. Never mix Supabase keys between `dev`, `staging`, and `prod`.

Branch and environment mapping:

| GitHub branch | Supabase target | Use for |
|---------------|-----------------|---------|
| `dev` | Local Supabase by default. Dev previews may use `f1-league-manager-nonprod`. | Daily development. |
| `staging` | `f1-league-manager-nonprod` | Release candidate testing. |
| `prod` | `f1-league-manager-prod` | Production releases only. |

Before any migration, deploy, seed, import, or environment change:

1. Run `git branch --show-current`.
2. Confirm the matching Supabase target.
3. Confirm the matching Vercel environment.
4. Stop if the branch and Supabase target do not match.

Pull request workflow:

| Change type | Branch from | Branch name | PR target |
|-------------|-------------|-------------|-----------|
| Feature | `dev` | `feature/short-description` | `dev` |
| Bug fix | `dev` | `fix/short-description` | `dev` |
| Release candidate | `dev` | `release/yyyy-mm-dd` | `staging` |
| Production promotion | `staging` | `promote/yyyy-mm-dd` | `prod` |
| Hotfix | `prod` | `hotfix/short-description` | `prod`, then back-merge |

PR rules:

1. Do not push directly to `dev`, `staging`, or `prod`.
2. Open a PR for every code or configuration change.
3. CI must pass before merge.
4. `dev` PR approval is recommended but not currently enforced; `staging` and `prod` still require approval.
5. Auth, RLS, migration, secret, deploy, and production changes need senior review.
6. PR descriptions must include test evidence.
7. `prod` PRs must first pass on `staging`.

---

## 4. Sprint Tracking Rules

Every sprint must be tracked as work happens.

Status values:

| Status | Use when |
|--------|----------|
| `Not started` | No work has started. |
| `In progress` | Work has started but is not complete. |
| `Done` | Work is complete, tested, reviewed, and accepted. |
| `Outstanding` | Work is incomplete and still required. |
| `Blocked` | Work cannot continue until another action happens. |

Rules:

1. Mark tasks as `Done` only after tests and review pass.
2. Mark tasks as `Outstanding` when they are not done by sprint review.
3. Every `Outstanding` item needs a clear reason.
4. Every `Blocked` item needs a blocker owner or next action.
5. Every `Done` item needs evidence.
6. Update this file at sprint review before starting the next sprint.

Use this tracker format at the end of each sprint section:

| Task | Status | Evidence | Outstanding reason / next action |
|------|--------|----------|----------------------------------|
| Example | Done | PR #1, `npm run sprint-verify` | None |
| Example | Outstanding | None | Waiting for environment variable |

---

## 5. Sprint Calendar

| Sprint | Theme | Main outcome |
|--------|-------|--------------|
| S0 | Approval and setup | Empty app passes quality gate. |
| S1 | Database and security foundation | Tables, RLS, auth guards, audit logs, and security headers exist. |
| S2 | UI foundation | F1-inspired public shell and reusable UI components exist. |
| S3 | League setup | Admin can create leagues, teams, drivers, reserves, transfers, and assets. |
| S4 | Public pages | Public standings, results, penalties, reports, and stats work. |
| S5 | Result publishing | Admin can publish results and app recalculates standings. |
| S6 | Calendar and wheel | Admin can manage calendars and confirm wheel-chosen circuits. |
| S7 | Racer garage | Racers can manage private setup notes. |
| S8 | Admin operations | Seasons, admin users, audits, and carry-overs work. |
| S9 | Spreadsheet import | Current workbook imports and matches app calculations. |
| S10 | Regression and security audit | Full test suite and security checks pass. |
| S11 | Performance and accessibility | App feels fast and is accessible. |
| S12 | Production release | App is deployed and smoke tested. |

---

## 6. Sprint Gate

A sprint is complete only when all of these pass.

| Gate | Requirement |
|------|-------------|
| TypeScript | `npm run type-check` has zero errors. |
| Lint | `npm run lint` has zero warnings. |
| Unit/component tests | `npm run test` passes. |
| Coverage | `npm run test:coverage` passes thresholds. |
| Build | `npm run build` passes without warnings. |
| E2E | `npm run test:e2e` passes. |
| Security | Protected features have negative tests. |
| Performance | New pages use bounded queries and compact data. |
| Review | `dev` PR has documented review notes; `staging` and `prod` PRs have reviewer approval. |

Coverage targets:

| Metric | Target |
|--------|--------|
| Lines | 85% |
| Functions | 85% |
| Branches | 80% |
| Statements | 85% |

---

## 7. S0 - Approval And Project Setup

### Goal

Get planning approved and create a clean Next.js project that can pass the empty quality gate.

### Build Steps

1. Get written approval for `HANDOVER.md`.
2. Get written approval for `SPRINT_PLAN.md`.
3. Confirm GitHub branches exist: `dev`, `staging`, and `prod`.
4. Confirm cloud Supabase projects exist: `f1-league-manager-nonprod` and `f1-league-manager-prod`.
5. Confirm local Supabase is available for daily `dev` work.
6. Document that local `dev` uses local Supabase, dev previews and `staging` use non-production Supabase, and `prod` uses production Supabase.
7. Configure GitHub branch protection for `dev`, `staging`, and `prod`.
8. Require PR reviews before merging to `staging` and `prod`; keep `dev` review recommended but not enforced.
9. Require CI status checks before merging to protected branches.
10. Create the Next.js app with TypeScript, App Router, Tailwind, and `src` directory.
11. Install testing tools: Vitest, React Testing Library, Playwright, and MSW.
12. Install app tools: Zod, Supabase JS, Supabase SSR helper, React Hook Form, lucide-react, Sentry, and Upstash client.
13. Configure `tsconfig.json` with strict mode.
14. Configure ESLint with zero-warning policy.
15. Configure Vitest coverage thresholds.
16. Configure Playwright with the local base URL.
17. Add `.env.example` with no real secrets.
18. Add `src/lib/constants.ts` for all shared limits and magic numbers.
19. Add `src/lib/env.ts` for server-side environment validation.
20. Add GitHub Actions CI for type-check, lint, tests, build, E2E, audit, and secret scan.

### Tests To Add

1. One basic unit test.
2. One basic component test.
3. One basic Playwright smoke test.
4. One env validation test.
5. One constants import test.

### Done When

1. Both documents are approved.
2. No app code was written before approval.
3. Branch-to-Supabase mapping is documented and understood.
4. Branch protection is configured for `dev`, `staging`, and `prod`.
5. `dev` PRs can be owner-merged after CI and documented review; `staging` and `prod` require approval.
6. `npm run sprint-verify` passes.

### Sprint Tracker

| Task | Status | Evidence | Outstanding reason / next action |
|------|--------|----------|----------------------------------|
| Document approval | Done | Owner approved `HANDOVER.md`, `SPRINT_PLAN.md`, and `PREREQUISITES.md` on 2026-05-07 | None |
| Work branch created | Done | `feature/s0-scaffold` based from `origin/dev` | None |
| Branch/Supabase model documented | Done | Docs updated for local dev, non-production, and production Supabase targets | None |
| Next.js app scaffolded | Done | `package.json`, `src/app`, `next.config.ts`, `tsconfig.json` | None |
| S0 dependencies installed | Done | `package-lock.json`, npm install completed | None |
| Quality scripts configured | Done | `package.json` scripts include `sprint-verify` and `deploy:check` | None |
| TypeScript strict mode configured | Done | `tsconfig.json`, `npm run type-check` passed | None |
| ESLint zero-warning gate configured | Done | `eslint.config.mjs`, `npm run lint` passed | None |
| Vitest and coverage configured | Done | `vitest.config.ts`, `npm run test:coverage` passed at 100% | None |
| Playwright configured | Done | `playwright.config.ts`, `npm run test:e2e` passed | None |
| `.env.example` created | Done | `.env.example` added with local Supabase defaults | None |
| Constants module created | Done | `src/lib/constants.ts`, unit test passed | None |
| Server env validation created | Done | `src/lib/env.ts`, unit test passed | None |
| CI workflow created | Done | `.github/workflows/ci.yml` | None |
| Full S0 gate | Done | `npm run sprint-verify` passed | None |
| Deploy check | Done | `npm run deploy:check` passed | None |
| Developer machine check | Done | `scripts/check-dev.ps1` passed with no failures | Warnings remain for missing `.env.local` and optional Playwright browser reminder |
| GitHub branch protection | Done | `dev`, `staging`, and `prod` protection checked on GitHub; `dev` review requirement removed for owner merges | None |
| Local Supabase CLI availability | Done | `npx supabase --version` reports `2.98.2`; dev check script detects local CLI | None |
| Local Supabase stack running | Done | `npx supabase status` confirms local Supabase is running | None |
| Local `.env.local` | Done | `.env.local` exists and dev check passes | None |
| PR creation and merge | Done | PR #1 merged into `dev` on 2026-05-07 after CI passed and local Codex review completed | None |

---

## 8. S1 - Database And Security Foundation

### Goal

Create the secure data foundation before building UI features.

### Build Steps

1. Confirm the current branch is `dev` for normal development.
2. Confirm local env vars point to local Supabase for daily development.
3. Confirm `f1-league-manager-nonprod` exists for shared dev previews and staging.
4. Confirm `f1-league-manager-prod` exists but is not used for local development.
5. Create database migrations for all core tables from `HANDOVER.md`.
6. Enable RLS on every table.
7. Add public read policies for public data.
8. Add racer owner policies for private setup data.
9. Add admin write policies where needed.
10. Add profiles with roles: racer, admin, super_admin.
11. Add official team templates.
12. Add circuit library.
13. Add storage buckets for league and team assets.
14. Add indexes for all common public queries.
15. Create browser Supabase client using anon key only.
16. Create server Supabase client for authenticated server routes.
17. Create server-only service role client.
18. Add admin auth guard that reads role from `profiles`.
19. Add racer auth guard that checks ownership.
20. Add CSRF protection for all mutating routes.
21. Add rate limiting for auth and admin APIs.
22. Add security headers.
23. Add sanitized error helper.
24. Add audit log service.

### Tests To Add

1. Public user can read public tables.
2. Public user cannot write protected tables.
3. Racer can read and write only own private setup data.
4. Admin route returns 401 without login.
5. Admin route returns 403 for racer role.
6. Admin route ignores client-supplied role.
7. Mutating route rejects missing CSRF token.
8. Rate limit blocks repeated requests.
9. Production errors do not leak stack traces.
10. Service role key is not in the client bundle.

### Done When

1. RLS exists on every table.
2. Auth guards are reusable.
3. Audit logging is available for later sprints.
4. Security headers are tested.
5. `npm run sprint-verify` passes.

### Sprint Tracker

| Task | Status | Evidence | Outstanding reason / next action |
|------|--------|----------|----------------------------------|
| Branch and local environment confirmed | Done | `feature/s1-database-auth-security`, local `.env.local`, local Supabase running | None |
| Core schema migration created | Done | `supabase/migrations/20260507161000_s1_core_schema.sql` | None |
| RLS enabled on every core table | Done | Local DB query found 24 of 24 public tables with RLS enabled | None |
| Public read and admin write policies added | Done | Migration includes public read policies and admin manage policies | None |
| Racer setup owner policies added | Done | `vehicle_setups` owner policies and `owns_driver` helper added | None |
| Official team templates seeded | Done | Local DB query found 10 templates | None |
| Circuit library seeded | Done | Local DB query found 24 2025 circuits; source: Formula 1 2025 calendar | None |
| Storage buckets added | Done | Migration creates `league-assets` and `team-assets` buckets | None |
| Supabase clients added | Done | Browser, server, and service role client modules added | None |
| Admin auth guard added | Done | `requireAdminContext`, admin health route, and unit tests | None |
| CSRF, rate limit, sanitized errors, audit helper added | Done | Security helper modules and unit tests | None |
| Local migration applied | Done | `npx supabase migration up --local` succeeded | None |
| Schema diff clean | Done | `npx supabase db diff --local` returned no schema changes | None |
| S1 full verification gate | Done | `npm run sprint-verify` passed; 15 tests passed; branch coverage 96.55% | None |

---

## 9. S2 - UI Foundation

### Goal

Build the F1-inspired visual foundation and public layout.

### Build Steps

1. Add F1-inspired color tokens in global CSS.
2. Add team color tokens.
3. Load Titillium Web with `next/font`.
4. Load JetBrains Mono with `next/font`.
5. Create three theme modes:
   - Race Weekend for public pages.
   - Race Control for admin pages.
   - Driver Garage for racer pages.
6. Build reusable UI components:
   - Button.
   - Status pill.
   - Team badge.
   - Driver chip.
   - Position delta.
   - Race format tag.
   - Empty state.
   - Error state.
7. Build public header with league switcher.
8. Build public footer.
9. Build league directory page.
10. Build league hub page with next race, latest result, top drivers, top constructors, penalties, and wheel status.
11. Build race countdown.
12. Build responsive mobile navigation.
13. Add loading states.
14. Add desktop and mobile screenshots using Playwright.

### Tests To Add

1. Header renders league links.
2. League hub renders meaningful server data.
3. Countdown handles upcoming and missing race.
4. UI components render correct states.
5. Mobile width at 375px has no horizontal scroll.
6. Reduced-motion mode does not rely on animation.
7. Numeric data uses JetBrains Mono.

### Done When

1. The app looks modern, sharp, and motorsport-specific.
2. Public pages are not a marketing landing page.
3. No official F1 protected logos are copied.
4. Mobile layout is usable.
5. `npm run sprint-verify` passes.

### Sprint Tracker

| Task | Status | Evidence | Outstanding reason / next action |
|------|--------|----------|----------------------------------|
| Branch created | Done | `feature/s2-ui-foundation` from `dev` | None |
| F1 color tokens added | Done | `src/app/globals.css` defines F1 and team CSS tokens | None |
| Titillium Web and JetBrains Mono loaded | Done | `src/app/layout.tsx` uses `next/font/google` | None |
| Public shell added | Done | `PublicHeader`, `PublicFooter`, `PublicShell` | None |
| Reusable UI components added | Done | Button, status pill, team badge, driver chip, position delta, race format tag, empty state, error state | None |
| League directory page added | Done | `/` renders Informal and Standard league cards | None |
| League hub pages added | Done | `/leagues/informal` and `/leagues/standard` | None |
| Race countdown utility added | Done | `RaceCountdown` and `getCountdownParts` tested | None |
| Mobile navigation added | Done | Header `details` menu for mobile viewports | None |
| Playwright screenshots added | Done | E2E writes desktop and mobile screenshots to ignored `test-results` paths | None |
| S2 verification gate | Done | `npm run sprint-verify` passed; 19 tests passed; E2E captured desktop/mobile screenshots | None |

---

## 10. S3 - League Setup, Teams, Drivers, Reserves, Transfers, And Assets

### Goal

Let admins create and manage leagues before results are entered.

### Build Steps

1. Build league creation form.
2. Let admin choose official team templates or custom teams.
3. Let admin configure league points systems.
4. Let admin enable or disable fastest lap bonus.
5. Let admin enable or disable pole bonus.
6. Let admin configure penalty threshold display.
7. Let admin upload league logo and hero image.
8. Let admin upload team logo and team car image.
9. Build team CRUD.
10. Build driver CRUD.
11. Link racers to driver records.
12. Enforce two primary drivers per team.
13. Add reserve driver slots.
14. Build manual reserve assignment per race.
15. Build mid-season driver transfer screen.
16. Support driver leaving a team.
17. Support driver rejoining later.
18. Preserve old result team history after transfers.
19. Audit all admin changes.

### Tests To Add

1. Admin can create league with official teams.
2. Admin can create league with custom teams.
3. Asset upload rejects invalid file type.
4. Asset upload rejects oversized file.
5. Team cannot have more than two primary drivers.
6. Reserve assignment affects one race only.
7. Transfer requires previous team.
8. Transfer requires last completed race.
9. Transfer does not rewrite historical result rows.
10. Driver can leave and rejoin later.
11. Driver can participate in more than one league.
12. Admin changes write audit logs.

### Done When

1. Admin can create a league ready for calendar and results.
2. Roster history is accurate.
3. Assets are scoped to the correct league/team.
4. `npm run sprint-verify` passes.

### Sprint Tracker

| Task | Status | Evidence | Outstanding reason / next action |
|------|--------|----------|----------------------------------|
| Branch created | Done | `feature/s3-league-setup` from `dev` | None |
| League creation API + form | Done | `POST /api/admin/leagues`, `LeagueForm`, PR #5 | None |
| Team creation API + form (official template and custom) | Done | `POST /api/admin/leagues/[id]/teams`, `TeamForm`, PR #5 | None |
| Points system creation API + form | Done | `POST /api/admin/leagues/[id]/points-systems`, `PointsSystemForm`, PR #5 | None |
| Driver global creation API + form | Done | `POST /api/admin/drivers`, `DriverForm`, PR #5 | None |
| Add driver to league API + form | Done | `POST /api/admin/leagues/[id]/drivers`, `AddLeagueDriverForm`, PR #5 | None |
| Reserve driver management | Done | `POST /api/admin/leagues/[id]/reserves`, PR #5 | None |
| Transfer API | Done | `POST /api/admin/leagues/[id]/transfers`, preserves historical result team, PR #5 | None |
| Transfer UI form + page | Done | `TransferForm`, `/admin/leagues/[id]/transfers/new`, `fix/s3-handover-gaps` | None |
| League asset upload API + UI | Done | `POST /api/admin/leagues/[id]/assets`, `LeagueAssetUpload`, `fix/s3-handover-gaps` | None |
| Team asset upload API | Done | `POST /api/admin/leagues/[id]/teams/[teamId]/assets`, `fix/s3-handover-gaps` | None |
| League activation endpoint + UI | Done | `PATCH /api/admin/leagues/[id]/status`, `LeagueStatusButton`, `fix/s3-handover-gaps` | None |
| League admin detail page | Done | `/admin/leagues/[id]`, shows status, assets, points systems, teams, drivers, PR #5 | None |
| Two primary driver limit enforced | Done | `MAX_PRIMARY_DRIVERS_PER_TEAM = 2` enforced in add-driver and transfer APIs | None |
| Transfer frozen-history rule enforced | Done | Transfer API closes/opens stints; never touches `race_results` | None |
| CSRF: HMAC-signed tokens | Done | Rewrote `csrf.ts` with `generateCsrfToken`/`verifyCsrfToken`, `/api/csrf` returns signed token, `fix/s3-handover-gaps` | None |
| Rate limiter wired into `withAdminGuard` | Done | `createAdminRateLimiter` called in guard pipeline, `fix/s3-handover-gaps` | None |
| Origin check added to `withAdminGuard` | Done | Compares `Origin`/`Referer` to `NEXT_PUBLIC_SITE_URL`, `fix/s3-handover-gaps` | None |
| Storage bucket constants (league-assets, team-assets) | Done | `LEAGUE_ASSETS_BUCKET`, `TEAM_ASSETS_BUCKET` in `constants.ts`, routes updated, `fix/s3-handover-gaps` | None |
| Admin changes write audit logs | Done | All admin APIs call `writeAdminAuditLog` after mutations | None |
| S3 schema unit tests | Done | `src/__tests__/unit/s3-admin.test.ts` — 40 tests for team, driver, transfer, points, asset schemas | None |
| Security negative tests (401, 403, CSRF) | Done | `src/__tests__/unit/api-guard.test.ts` — 8 guard pipeline tests including CSRF rejection | None |
| 71 tests passing, lint clean | Done | `npm run test` 71/71; `npm run lint` zero warnings on `fix/s3-gate-and-handover-compliance` | None |
| S3 admin E2E tests | Outstanding | Smoke E2E passes, but no seeded admin browser flow yet | Requires local Supabase admin seed and authenticated Playwright storage state before S4 public work expands |
| `npm run sprint-verify` full gate | Done | `npm run deploy:check` passed on `fix/s3-gate-and-handover-compliance`; includes type-check, lint, tests, coverage, build, E2E, audit, and secret scan | None |

---

## 11. S4 - Public Standings, Results, Penalties, Reports, And Statistics

### Goal

Build the public pages viewers and drivers use after results are published.

### Build Steps

1. Build driver standings table.
2. Build constructor standings table.
3. Show position, driver, team, points, gap to leader, wins, podiums, fastest laps, and penalties.
4. Add position change indicators.
5. Add team color treatment.
6. Add season selector.
7. Build public results index.
8. Build individual race result page.
9. Build qualifying results page.
10. Build race reports page.
11. Build public penalty screen.
12. Build driver profile page.
13. Build team profile page.
14. Build league statistics page.
15. Use compact server DTOs.
16. Use precomputed standings snapshots.
17. Add mobile card layout for standings and reports.
18. Add cache/revalidation after publish, transfer, penalty, wheel, and asset changes.

### Tests To Add

1. Driver standings sort correctly.
2. Constructor standings sort correctly.
3. Gap shows gap to leader.
4. Tied drivers display equal points clearly.
5. League and season filters isolate data.
6. Penalty screen shows discipline history.
7. Penalty screen does not expose private steward-only notes.
8. Race report shows qualifying, grid, finish, fastest lap, penalties, and bans.
9. Public pages work without authentication.
10. Mobile pages have no horizontal scroll.

### Done When

1. Viewers can understand the league without admin access.
2. Public pages expose no private racer setup data.
3. Public pages are fast because they read snapshots.
4. `npm run sprint-verify` passes.

### S4 Sprint Tracker

| Task | Status | Evidence | Outstanding reason / next action |
|------|--------|----------|----------------------------------|
| `resolvePublicLeague` — shared server-only resolver excluding draft leagues | Done | `src/lib/public/resolve-league.ts`; 4 unit tests in `s4-public.test.ts` | None |
| League hub wired to real DB data (top 5 drivers, constructors, penalty alerts, next race) | Done | `src/app/leagues/[slug]/page.tsx`, `src/components/league/LeagueHub.tsx` | None |
| `PublicPageHeader` component (league, season, last round, format, updated date) | Done | `src/components/league/PublicPageHeader.tsx`; 6 component tests in `public-page-header.test.tsx` | None |
| Driver standings page (desktop table + mobile cards, gap, delta, team color) | Done | `src/app/leagues/[slug]/standings/drivers/page.tsx` | None |
| Constructor standings page (gated by `constructor_championship_enabled`, notFound if disabled) | Done | `src/app/leagues/[slug]/standings/constructors/page.tsx` | None |
| Results index page | Done | `src/app/leagues/[slug]/results/page.tsx` | None |
| Race result detail page (qualifying, race, HANDOVER sort order, penalties without steward_notes) | Done | `src/app/leagues/[slug]/results/[sessionId]/page.tsx` | None |
| Public penalties page (steward_notes and appeal_notes excluded per HANDOVER §8.4 and §13) | Done | `src/app/leagues/[slug]/penalties/page.tsx` | None |
| Driver profile page (two-step fetch to scope results to league sessions) | Done | `src/app/leagues/[slug]/drivers/[driverId]/page.tsx` | None |
| Team profile page (current drivers via active stints, race results per session) | Done | `src/app/leagues/[slug]/teams/[teamId]/page.tsx` | None |
| League stats page (season at a glance, most wins/podiums/FL from precomputed standings) | Done | `src/app/leagues/[slug]/stats/page.tsx` | None |
| `PositionDelta` component updated to accept `current`/`previous` props | Done | `src/components/ui/PositionDelta.tsx`; 4 component tests in `position-delta.test.tsx` | None |
| Result sort order: classified → dnf → dns → dsq → ban | Done | `s4-public.test.ts` — 4 result sort tests | None |
| Gap to leader calculation | Done | `s4-public.test.ts` — 3 gap tests | None |
| Penalty field safety — no steward_notes or appeal_notes in public select strings | Done | `s4-public.test.ts` — 2 file-source tests stripping JS comments before checking | None |
| Public read hardening for draft leagues and penalty audit fields | Done | `supabase/migrations/20260508123000_s4_public_security_boundaries.sql`; schema regression test | None |
| S4 component tests (LeagueHub full-data scenarios, PublicPageHeader, PositionDelta) | Done | 13 new tests across `league-hub.test.tsx`, `public-page-header.test.tsx`, `position-delta.test.tsx` | None |
| `writeAdminAuditLog` coverage (success and failure paths) | Done | Added to `api-guard.test.ts` | None |
| Per-league sub-navigation (Hub / Standings / Results / Penalties / Stats) | Done | `src/components/league/LeagueSubNav.tsx`, `src/app/leagues/[slug]/layout.tsx` — active tab highlighted via `usePathname` | None |
| Mobile E2E smoke updated to use home page (no DB dependency) | Done | `e2e/smoke.spec.ts` — 2 tests pass | None |
| 105 tests passing, lint clean, type-check clean | Done | `npm run test` passes: 105/105 tests; `npm run test:coverage`, `npm run lint`, `npm run type-check`, `npm run build`, and `npm run test:e2e` pass | None |
| Precomputed standings snapshots used (no recalculation on page load) | Done | All standings pages read from `driver_standings`/`team_standings` tables only | None |
| S4 qualifying results page | Outstanding | None | Qualifying data shown on race result detail page; standalone qualifying page deferred to S5 |
| S4 race reports page | Outstanding | None | Deferred to S5 — requires published results data to be meaningful |
| Season selector on standings pages | Outstanding | None | Deferred to S5/S6 — single active season per league in MVP |
| Cache/revalidation after publish | Outstanding | None | Deferred to S5 — result publishing workflow not yet built |

---

## 12. S5 - Result Publishing, Points, Penalties, And Standings

### Goal

Build the admin result publishing workflow and the calculation engine.

### Build Steps

1. Build result entry stepper:
   - Session.
   - Qualifying.
   - Race results.
   - Penalties and bans.
   - Review and publish.
2. Add finishing position entry.
3. Add qualifying position entry.
4. Add grid start entry.
5. Add fastest lap entry.
6. Add DNF, DNS, DSQ, BAN, and did-not-participate statuses.
7. Add reserve team selector for reserve appearances.
8. Add disciplinary penalty points.
9. Add manual ban fields.
10. Add steward review status field.
11. Add appeal status field.
12. Add manual championship point adjustments.
13. Parse workbook-style time gaps.
14. Calculate driver race points on the server.
15. Calculate constructor race points on the server.
16. Recalculate driver standings after publish.
17. Recalculate constructor standings after publish.
18. Recalculate penalty totals after publish.
19. Prevent duplicate publish for a completed session.
20. Show review screen before publish.
21. Audit publish and edit actions.

### Tests To Add

1. Standard F1 points are correct.
2. Custom points are correct.
3. Fastest lap bonus can be enabled or disabled.
4. Pole bonus can be enabled or disabled.
5. DNF scores zero championship points.
6. Manual championship adjustment affects standings.
7. Disciplinary penalty points do not affect championship standings.
8. Constructor standings include reserve appearances correctly.
9. Duplicate result publish returns conflict.
10. Client-supplied points are rejected or ignored.
11. Time-gap parser handles all workbook formats.
12. Standings tie-breaks are correct.
13. Result publish writes audit logs.

### Sprint Evidence

| Task | Status | Evidence |
|------|--------|----------|
| Points engine (`calculateRacePoints`) | Done | `src/lib/results/points.ts` — server-only, FL + pole bonus, non-classified → 0 |
| Workbook gap parser (`parseWorkbookGap`) | Done | `src/lib/results/parse-gap.ts` — all HANDOVER §11 formats |
| Standings builders | Done | `src/lib/results/standings.ts` — driver/team/penalty, tie-break order, carry-over |
| Publish service (`publishSession`) | Done | `src/lib/results/publish-service.ts` — recalc standings before completed, cross-field validation, audit log |
| Publish API route | Done | `POST /api/admin/sessions/[id]/publish` — Zod-validated, no client `points_awarded` |
| Sessions API route | Done | `GET + POST /api/admin/leagues/[id]/sessions` — create with circuit + PS |
| Session create UI | Done | `SessionForm.tsx` + `/admin/leagues/[id]/sessions/new` |
| Result entry stepper | Done | `ResultStepper.tsx` — qualifying → results → penalties → review → publish |
| League admin sessions section | Done | `/admin/leagues/[id]` — sessions list + "Enter Results" links |
| Post-review fixes | Done | Standings reorder, rescinded penalty filter, penaltyMap aggregation, server cross-field validation, stable React keys |
| Unit tests | Done | `s5-points.test.ts` — 167 tests (all 13 HANDOVER scenarios + tie-breaks + parser + 5 validatePublishResults) |
| `sprint-verify` gate | Done | type-check ✓ · lint ✓ · 167 tests ✓ · coverage ✓ · build ✓ · E2E ✓ |

### Done When

1. Admin can publish a race result. ✓
2. Public driver standings update. ✓ (recalculateStandings rebuilds driver_standings)
3. Public constructor standings update. ✓ (rebuilds team_standings when enabled)
4. Penalty totals update. ✓ (upserts driver_penalty_totals)
5. `npm run sprint-verify` passes. ✓

---

## 13. S6 - Calendar And Digital Wheel

### Goal

Build calendar management and the server-confirmed digital wheel.

### Build Steps

1. Build admin calendar CRUD.
2. Let admins pre-populate races before the season.
3. Add circuit picker from circuit library.
4. Add custom circuit option if needed.
5. Build public calendar page.
6. Build wheel circuit pool setup.
7. Build digital wheel animation.
8. Make server choose and store candidate wheel result.
9. Let admin confirm the wheel result.
10. Create the next race session after confirmation.
11. Remove used circuit from the eligible pool.
12. Build public wheel history page.
13. Audit wheel spins and confirmations.

### Tests To Add

1. Admin can create calendar events.
2. Public calendar shows completed and upcoming races.
3. Wheel selects only eligible circuits.
4. Wheel never returns null.
5. Wheel throws when pool is empty.
6. Used circuit is removed from pool.
7. Client cannot forge wheel result.
8. Double confirmation is rejected.
9. Public wheel history shows confirmed spins only.

### Done When

1. Calendar works for manual leagues.
2. Wheel works for wheel leagues.
3. Wheel result is server-authoritative.
4. `npm run sprint-verify` passes.

### Sprint Tracker

| Task | Status | Evidence | Outstanding reason / next action |
|------|--------|----------|----------------------------------|
| Admin calendar CRUD | Done | `PATCH/DELETE` APIs + UI `SessionDeleteButton`; PR #10 validation passed | None |
| Pre-populate races | Done | `SessionForm` supports creating and editing upcoming sessions | None |
| Circuit picker | Done | `SessionForm` dropdown uses `circuits` table | None |
| Public calendar page | Done | `src/app/leagues/[slug]/calendar/page.tsx` | None |
| Wheel circuit pool setup | Done | `WheelManager` UI + `PUT` API to update `league_circuit_pools` | None |
| Digital wheel animation | Done | Client-side visual delay + loader in `WheelManager.tsx` | None |
| Server choose candidate | Done | `POST /api/admin/leagues/[id]/wheel/spin` randomly selects and creates pending spin | None |
| Admin confirm wheel result | Done | Confirmation passes `spin_id` to `SessionForm` | None |
| Create race session | Done | Session API handles `wheel_spin_id` and creates race session | None |
| Remove used circuit | Done | Session API updates pool `is_available = false` on confirmation | None |
| Public wheel history | Done | `src/app/leagues/[slug]/wheel/page.tsx` | None |
| Audit wheel spins | Done | `wheel.spun`, `wheel.confirmed`, `wheel.voided` audit logs implemented | None |
| Validation gate | Done | Local `type-check`, `lint`, `test` (181 tests), `build`, and `git diff --check` passed; PR #10 CI passed | Authenticated browser E2E can be expanded in a later sprint |

### S6 Merge Note

S6 was merged to `dev` via PR #10 on May 9, 2026.

| Item | Evidence / note |
|------|-----------------|
| Merge commit | `654aa93 feat(s6): calendar and digital wheel` |
| Review fixes | Public wheel history now uses `resolvePublicLeague`; wheel confirmation uses atomic RPC; points-system ownership is validated on session create/update. |
| Local migration applied | `supabase/migrations/20260509101500_s6_confirm_wheel_spin_session.sql` was applied to local Supabase Docker with `npx.cmd supabase migration up`. |
| Shared environment reminder | Apply the S6 migration to any shared dev preview, staging, or production target before validating S6 there. |
| Validation | PR #10 CI passed; local `type-check`, `lint`, `test` (181 tests), `build`, and `git diff --check` passed before merge. |

---

## 14. S7 - Racer Garage

### Goal

Let racers manage private vehicle setups.

### Build Steps

1. Add racer dashboard.
2. Add setup list page.
3. Add setup create form.
4. Add setup edit form.
5. Add setup delete flow.
6. Add setup duplicate action.
7. Add copy setup to another circuit action.
8. Add filters for circuit, weather, game version, league, and visibility.
9. Keep setups private by default.
10. Add owner-only access checks.
11. Store setup data with bounded JSON size.
12. Do not load full setup JSON in list view.

### Tests To Add

1. Racer can create setup.
2. Racer can edit own setup.
3. Racer can delete own setup.
4. Racer can duplicate own setup.
5. Racer cannot read another racer's setup.
6. Racer cannot edit another racer's setup.
7. Setup payload size is capped.
8. Setup list uses summary data, not full setup JSON.

### Sprint Tracker

| Task | Status | Evidence | Outstanding reason |
|------|--------|----------|--------------------|
| Racer dashboard / list page | Done | `/garage` server component, `force-dynamic` | - |
| Setup create form | Done | `SetupForm.tsx`, `/garage/new` page | - |
| Setup edit form | Done | `/garage/[id]/edit` page, PATCH route | - |
| Setup delete flow | Done | DELETE route, SetupCard delete button | - |
| Setup duplicate action | Done | POST `/api/racer/setups/[id]/duplicate` | - |
| Owner-only access (server + RLS) | Done | `resolveOwnedSetup` helper, `owns_driver` RLS | - |
| Private by default | Done | `is_public: false` default; duplicate forces private | - |
| No setup_data in list view | Done | GET select excludes `setup_data`; test verifies | - |
| Filters: circuit, weather, league | Done | URL search params, `?circuit_id` `?weather` `?league_id` | - |
| S7 migration (`league_id` on vehicle_setups) | Done | `20260509120000_s7_vehicle_setups_league.sql` | - |
| Racer guard (section 7 security pipeline) | Done | `src/lib/racer/api-guard.ts` | - |
| 46 new unit tests | Done | `npm run test` -> 227 passing | - |
| Sprint gate passes | Done | `npm run deploy:check` passed locally; PR #11 CI `verify` passed after Next 16.2.6 security patch | - |
| Copy setup from another circuit (UI shortcut) | Deferred | - | Can be added later; duplicate + edit covers the workflow |
| Game version autocomplete | Deferred | - | Free text sufficient for MVP |
| Racer garage E2E tests | Deferred | - | Requires auth E2E helpers not yet built |

### Done When

1. Racer garage is useful and private.
2. Owner checks exist in RLS and server code.
3. `npm run sprint-verify` passes.

---

## 15. S8 - Admin Operations, Seasons, Carry-Overs, And Audit

### Goal

Build the operational tools needed to run multiple seasons safely.

### Build Steps

1. Build season CRUD.
2. Mark one season as current per league.
3. Archive old seasons.
4. Add season selectors to admin pages.
5. Add carry-over penalty points.
6. Add carry-over unserved bans.
7. Add super-admin user management.
8. Let super admin promote or demote admins.
9. Prevent normal admins from managing roles.
10. Build audit log viewer.
11. Add filters for audit log by actor, action, league, season, and date.
12. Make audit logs append-only.
13. Add optional Discord webhook setting as disabled stretch foundation.

### Tests To Add

1. Admin can create new season.
2. Old season results remain visible.
3. Carry-over penalties apply to the new season discipline totals.
4. Carry-over bans show as unserved until manually served.
5. Super admin can manage admin roles.
6. Normal admin cannot manage admin roles.
7. Audit logs cannot be edited or deleted from the app.
8. Audit metadata does not store secrets.

### Sprint Tracker

| Task | Status | Evidence | Outstanding reason / next action |
|------|--------|----------|----------------------------------|
| Branch created | Done | `feature/s8-admin-operations` from `dev` | None |
| S8 migration (`is_archived` on seasons + audit_logs indexes) | Done | `supabase/migrations/20260512000000_s8_admin_operations.sql`; applied locally | None |
| Season mark-as-current API | Done | `PATCH /api/admin/seasons/[id]/current`; clears others, blocks archived, audit log | None |
| Season archive/unarchive API | Done | `PATCH /api/admin/seasons/[id]/archive`; blocks current season, audit log | None |
| Season detail page | Done | `/admin/seasons/[id]` — status display, SeasonActions, CarryOverForm per league | None |
| Seasons list links to detail page | Done | `/admin/seasons` each row links to `/admin/seasons/[id]` | None |
| Season selectors on admin pages | Done | `SeasonSelector` component on `/admin/leagues/[id]`; Zod-validated `?season_id=` param; filters `race_sessions` and `league_driver_entries` by season; defaults to current season then league's own season | None |
| Carry-over API | Done | `POST /api/admin/leagues/[id]/carry-over`; upserts `league_driver_entries` with `carry_over_penalty_points` + `carry_over_ban_count`; audit log | None |
| CarryOverForm component | Done | `src/components/admin/CarryOverForm.tsx`; shown per league on season detail page | None |
| Super-admin users list API | Done | `GET /api/admin/users`; super_admin only; returns admin + super_admin profiles | None |
| Super-admin role change API | Done | `PATCH /api/admin/users/[id]/role`; super_admin only; blocks self-change; audit log | None |
| User roles page | Done | `/admin/users`; super_admin redirect guard server-side; UserRoleForm per user | None |
| Audit log API | Done | `GET /api/admin/audit`; filters by actor, action, entity_type, date_from, date_to; bounded by `MAX_AUDIT_LOGS_LIST` | None |
| Audit log viewer page | Done | `/admin/audit`; server-rendered AuditLogTable with pagination | None |
| Admin nav updated | Done | `AdminShell.tsx` — Audit Log for all admins; User Roles for super_admin only | None |
| Discord webhook stub | Done | `DISCORD_WEBHOOK_URL` already in `env.ts` + `.env.example`; no webhook sending — disabled foundation only | None |
| 32 new S8 unit tests | Done | `npm run test` → 259 passing | None |
| `npm run sprint-verify` gate | Done | type-check ✓ · lint ✓ · 259 tests ✓ · coverage ✓ · build ✓ · E2E ✓ | None |

### Done When

1. The app supports historical seasons. ✓
2. Admin role management is safe. ✓
3. Audit history is searchable and append-only. ✓
4. `npm run sprint-verify` passes. ✓

---

## 16. S9 - Spreadsheet Import

### Goal

Import the current Season 2 workbook and prove the app matches the workbook calculations.

Workbook path:

```text
c:\Users\rajma\OneDrive\F1 2025\4QM8 F1 2025 Season 2.xlsx
```

### Build Steps

1. Build admin import page.
2. Accept only `.xlsx` files.
3. Reject oversized workbooks before parsing.
4. Parse required workbook sheets.
5. Import league settings.
6. Import points systems.
7. Import teams and drivers.
8. Import transfers.
9. Import carry-over penalties.
10. Import carry-over unserved bans.
11. Import qualifying results.
12. Import race results.
13. Import penalties and manual bans.
14. Import manual championship adjustments.
15. Run app calculations from imported raw data.
16. Compare app standings to workbook standings.
17. Show diff report.
18. Block confirmation while diff exists.
19. Confirm import only when diff is clean.
20. Lock the season against re-import after confirmation.
21. Audit upload, parse, diff, and confirmation events.

### Tests To Add

1. Non-xlsx file is rejected.
2. Oversized workbook is rejected.
3. Missing required sheet is rejected.
4. Unexpected large sheet regions are rejected.
5. Workbook time gaps parse correctly.
6. Transfers import correctly.
7. Carry-over penalties import correctly.
8. Manual championship adjustments import correctly.
9. Driver standings match workbook.
10. Constructor standings match workbook.
11. Import confirmation is blocked when diff exists.
12. Re-import is rejected after confirmation.
13. Parser errors are sanitized.
14. Raw workbook rows are not sent to the browser.

### Done When

1. The real workbook imports.
2. Diff report is clean.
3. Season migration is locked after confirmation.
4. `npm run sprint-verify` passes.

---

## 17. S10 - Regression And Security Audit

### Goal

Freeze features, run the full test suite, and attempt common attacks before polish.

### Build Steps

1. Run all accumulated tests.
2. Fix every regression.
3. Review every admin route for auth, role check, CSRF, Zod validation, audit log, and sanitized errors.
4. Review every racer route for owner checks.
5. Review every table for RLS.
6. Search source and build output for leaked secrets.
7. Run dependency audit.
8. Try forged result submission.
9. Try forged wheel confirmation.
10. Try cross-racer setup access.
11. Try SQL injection strings in admin forms.
12. Try oversized payloads.
13. Try invalid workbook upload.
14. Review all service-role imports.
15. Review audit logs for secrets or huge metadata.

### Tests To Add

1. Unauthenticated admin mutation returns 401.
2. Racer admin mutation returns 403.
3. Admin mutation without CSRF returns 403.
4. Client-supplied points are blocked.
5. Forged wheel result is blocked.
6. Cross-racer setup access is blocked.
7. Production errors are generic.
8. Service role key is absent from client bundle.
9. Invalid import files are rejected before parsing.
10. Admin mutation without audit log fails test.

### Done When

1. There are zero regressions.
2. There are zero high or critical dependency audit findings.
3. Manual attack checks are blocked.
4. `npm run sprint-verify` passes on a clean checkout.

---

## 18. S11 - Performance, Accessibility, And UX Polish

### Goal

Make the app fast, accessible, and comfortable to use on race night.

### Build Steps

1. Run Lighthouse on public pages.
2. Run Lighthouse on login and racer garage pages.
3. Optimize images and brand assets.
4. Fix LCP, CLS, and INP issues.
5. Review public page bundle sizes.
6. Remove unnecessary client components.
7. Add keyboard navigation tests.
8. Add screen reader labels for tables and forms.
9. Check WCAG AA color contrast.
10. Capture mobile screenshots at 375px, 768px, 1024px, and desktop.
11. Fix text overlap and horizontal scroll.
12. Polish empty, loading, and error states.
13. Test admin result publish while public standings page is open.
14. Pause polling when browser tab is hidden.

### Tests To Add

1. Public pages meet Lighthouse Performance minimum 85.
2. Public pages target Lighthouse Performance 90 where feasible.
3. Pages meet Lighthouse Accessibility 90 or higher.
4. LCP is under 2.5s on tested public pages.
5. CLS is under 0.1 on tested public pages.
6. INP is under 200ms on tested public pages.
7. Keyboard navigation works for admin forms.
8. Mobile screenshots show no horizontal scroll.
9. Public standings remain responsive during admin publish.
10. Hidden tab polling pauses.

### Done When

1. The app feels fast on normal laptops and phones.
2. Public pages are accessible.
3. Admin workflows feel responsive.
4. `npm run sprint-verify` passes.

---

## 19. S12 - Production Deployment

### Goal

Deploy the app and prove the production release works.

### Build Steps

1. Run `npm run deploy:check` locally.
2. Open release PR from `dev` to `staging`.
3. Confirm staging deploy points to `f1-league-manager-nonprod`.
4. Apply migrations to staging first.
5. Run Playwright smoke tests against staging.
6. Get release PR reviewed and merged to `staging`.
7. Open production promotion PR from `staging` to `prod`.
8. Confirm production branch is `prod`.
9. Confirm production deploy points to `f1-league-manager-prod`.
10. Confirm production PR has senior review.
11. Apply production migrations.
12. Create production storage buckets.
13. Seed official team templates.
14. Seed circuit library.
15. Create first super admin account.
16. Add Vercel production environment variables.
17. Merge production PR and promote to production.
18. Run production smoke tests.
19. Record release notes.
20. Record rollback plan.

### Production Smoke Tests

1. Home page loads.
2. League hub loads.
3. Driver standings load.
4. Constructor standings load.
5. Penalties page loads.
6. Calendar page loads.
7. Wheel history page loads.
8. `/admin` redirects when logged out.
9. Admin can log in.
10. Admin can publish a test result.
11. Public standings update.
12. Racer can log in.
13. Racer can create private setup.
14. Another racer cannot view that setup.
15. Browser network responses contain no service role key or webhook URL.

### Done When

1. Production URL is live.
2. Smoke tests pass.
3. Admin publish flow works.
4. Public standings update.
5. Racer garage works privately.
6. Production deploy is from `prod`.
7. Production env vars point only to `f1-league-manager-prod`.
8. Production PR was reviewed and approved.
9. Rollback plan exists.

---

## 20. Required Test Files

Create these test groups as the related features are built.

| Test file | Covers |
|-----------|--------|
| `src/__tests__/unit/points.test.ts` | Standard points, custom points, bonuses, DNF, invalid positions. |
| `src/__tests__/unit/time-gap-parser.test.ts` | Workbook time gap formats and result status ordering. |
| `src/__tests__/unit/standings.test.ts` | Driver standings, constructor standings, tie-breaks, transfers, reserves. |
| `src/__tests__/unit/penalties.test.ts` | Penalty totals, thresholds, manual bans, carry-over. |
| `src/__tests__/unit/wheel.test.ts` | Eligible pool, used exclusions, empty pool, server confirmation. |
| `src/__tests__/unit/rosters.test.ts` | Two-driver teams, reserves, leave/rejoin, cross-league drivers. |
| `src/__tests__/unit/setups.test.ts` | Private setup validation and owner checks. |
| `src/__tests__/unit/spreadsheet-import.test.ts` | Workbook parsing and diff logic. |
| `src/__tests__/components/DriverStandingsTable.test.tsx` | Ordering, gaps, colors, ties, mobile state. |
| `src/__tests__/components/ResultEntryForm.test.tsx` | Result entry validation and review state. |
| `src/__tests__/components/WheelSpinner.test.tsx` | Wheel animation and reveal state. |
| `src/__tests__/api/admin-security.test.ts` | 401, 403, CSRF, role checks, sanitized errors. |
| `src/__tests__/api/results-security.test.ts` | Duplicate publish, forged points, oversized payloads. |
| `src/__tests__/api/racer-security.test.ts` | Setup owner isolation. |
| `src/__tests__/api/import-security.test.ts` | Workbook upload boundaries and confirmation lock. |
| `e2e/public-standings.spec.ts` | Public standings and no-auth access. |
| `e2e/public-penalties.spec.ts` | Public penalty screen. |
| `e2e/admin-league-setup.spec.ts` | League, team, driver, reserve setup. |
| `e2e/admin-driver-transfers.spec.ts` | Transfer, leave, and rejoin flows. |
| `e2e/admin-result-entry.spec.ts` | Result publish and standings update. |
| `e2e/wheel-spin.spec.ts` | Wheel spin and confirmation. |
| `e2e/racer-garage.spec.ts` | Racer setup privacy. |
| `e2e/admin-import.spec.ts` | Workbook import, diff, and lock. |

---

## 21. Definition Of Done

A feature is done only when:

1. It matches `HANDOVER.md`.
2. It has tests.
3. It validates input.
4. It handles errors.
5. It checks permissions.
6. It writes audit logs for admin state changes.
7. It does not leak secrets.
8. It uses bounded queries and payloads.
9. It works on desktop and mobile.
10. Branch and Supabase environment mapping is correct.
11. PR exists with test evidence.
12. PR has documented review notes; `staging` and `prod` PRs have reviewer approval.
13. Sprint tracker is updated with done and outstanding work.
14. Outstanding work has a reason and next action.
15. `npm run sprint-verify` passes.

That is the finish line every time.
