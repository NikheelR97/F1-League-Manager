# F1 Esports League Manager - Simple Developer Handover

**Status:** Planning only. Do not write app code until the owner approves these docs.
**Audience:** Interns, juniors, and any developer joining the project.
**Goal:** Build a fast, secure, modern F1 esports league app that replaces the current spreadsheet workflow.

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

---

## 15. Deployment

Target deployment:

| Part | Service |
|------|---------|
| App | Vercel |
| Database/Auth/Storage | Supabase |
| Rate limiting | Upstash |
| Monitoring | Sentry |

Before production:

1. `npm run sprint-verify`
2. `npm audit --audit-level=high`
3. Secret scan.
4. Production build.
5. E2E tests.
6. Manual smoke tests.

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
11. `npm run sprint-verify` passes.

