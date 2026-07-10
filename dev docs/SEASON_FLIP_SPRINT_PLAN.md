# Season Ownership Flip — Sprint Plan

**Goal:** Leagues become the parent entity. Seasons belong to a league ("Thursday League" → "Season 1", "Season 2"). A league is created first with zero seasons; seasons are added to it afterwards. Exactly one season per league may be *current*.

**Execution model:** Each sprint is run by a subagent (model noted per task). Sprints run **sequentially** — a sprint may not start until the previous sprint's gate passes. The orchestrator (main session) launches agents, reviews their reports, and runs gates.

- **sonnet** — anything with logic: SQL migration, API routes, services, non-mechanical test rewrites.
- **haiku** — mechanical work: inventories, 1:1 prop/name threading, test updates that mirror an already-made code change, doc updates.

**Hard gate after every sprint:** `npm run qa` (type-check + lint + vitest + build) must pass. Final gate: `npm run sprint-verify` (adds coverage + Playwright e2e). A sprint is not done until its gate is green; the sprint's agent fixes its own failures.

---

## Locked design decisions (do not re-litigate in sprints)

1. **Schema target:**
   - `seasons.league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE`
   - `seasons` gets `UNIQUE (league_id, name)` and `UNIQUE (id, league_id)` (the latter enables composite FKs below).
   - `seasons.is_current` becomes **per-league**: partial unique index `ON seasons (league_id) WHERE is_current`.
   - `leagues.season_id` is **dropped**. The league's current season is *derived*: `seasons WHERE league_id = ? AND is_current`. Leagues with zero seasons are valid (`status = 'draft'` until a season exists).
2. **Integrity without triggers:** every child table that carries both `league_id` and `season_id` (race_sessions, league_driver_entries, wheel_spins, penalties, championship_adjustments, driver_penalty_totals, driver_standings, team_standings, workbook_migrations) gets a composite FK `(season_id, league_id) REFERENCES seasons (id, league_id)` so a row can never reference a season belonging to a different league. Keep the existing single-column FKs/indexes.
3. **Data migration for existing rows:** seasons are currently global/shared. For each distinct `(league_id, season_id)` pair found across `leagues.season_id` + all child tables, clone the season row as a league-owned season, remap child rows to the clone, then delete orphaned global season rows. The league's `is_current` season = the clone of whichever season was `leagues.season_id` (fallback: newest by `starts_on`). Global `seasons.is_current` flag data is discarded (it was app-level UI default only).
4. **API shape:** season CRUD moves under the league:
   - `GET/POST /api/admin/leagues/[id]/seasons`
   - `PATCH /api/admin/leagues/[id]/seasons/[seasonId]/current` (sets is_current within that league only)
   - `PATCH /api/admin/leagues/[id]/seasons/[seasonId]/archive`
   - Old `/api/admin/seasons/*` routes are **deleted** (no deprecation shim — admin-only surface, we control all callers).
   - `POST /api/admin/leagues` no longer accepts `season_id`.
   - Write endpoints that stamped `league.season_id` (add driver, create session, wheel spin) now resolve the league's **current season** server-side and 409 with a clear message if the league has no current season. `?season_id` / body `season_id` remains an accepted explicit override where it already exists; server must validate the season belongs to the league (the composite FK is the backstop).
   - Carry-over becomes league-scoped: `POST /api/admin/leagues/[id]/carry-over` takes `from_season_id`, `to_season_id` (both must belong to the league) and **sets the target season current** on success — this IS the "start Season 2" rollover action.
5. **Admin UI:** seasons are managed on the league detail page (`/admin/leagues/[id]`) — list, create, set-current, archive, carry-over. Global `/admin/seasons` pages are deleted; the admin nav link is removed.
6. **Public pages:** default season = the league's current season; the existing season-selector behavior (URL `?season=` param + `resolveLeagueSeasons`) is preserved, just re-pointed at league-owned seasons.
7. **No RLS changes in intent:** replicate the existing policy pattern (`public read`, `admin manage`) onto the changed table; do not weaken any boundary.
8. **Naming:** UI copy says "Season" everywhere it already does; no renames beyond what the schema flip forces.

---

## Sprint 0 — Inventory & baseline (haiku)

**Tasks:**
1. Run `npm run qa`; record the green baseline (if not green, STOP and report — do not proceed on a broken baseline).
2. Produce `dev docs/season-flip-inventory.md`: every file referencing `season_id`, `seasonId`, `is_current`, `/admin/seasons`, `resolveLeagueSeasons`, `resolve-league`, grouped into: migrations/seed, API routes, admin pages/components, public pages/lib, unit tests, component tests, e2e specs + `scripts/seed-e2e.mjs`. One line per file: path + what it does with seasons.

**Gate:** baseline `npm run qa` green; inventory file exists and covers (at minimum) every file listed in the sprints below.

---

## Sprint 1 — Database migration + seed (sonnet)

**Tasks:**
1. New migration `supabase/migrations/<timestamp>_league_owned_seasons.sql` implementing decisions 1–3 exactly, in this order: add nullable `seasons.league_id` → clone/remap data (decision 3) → delete orphaned seasons → set NOT NULL → add unique constraints + partial index → add composite FKs to the nine child tables → drop `leagues.season_id` → RLS: keep existing seasons policies (they're already table-level; verify they still apply).
2. Update `supabase/seed.sql`: create league first, then its season with `league_id` + `is_current = true`.
3. Update `scripts/seed-e2e.mjs` the same way.
4. Update `src/__tests__/unit/schema.test.ts` to assert the new shape.
5. Verify the migration applies cleanly: `supabase db reset` locally (or `supabase migration up` if reset unavailable), then confirm seed loads.

**Out of scope:** any `src/` app code beyond the schema test. `npm run qa` type-check may reveal app code reading `leagues.season_id` — those fixes belong to Sprints 2–4; if type-check fails only for that reason, report it and mark the gate "green except known Sprint-2 breakage" ONLY if the breakage list exactly matches Sprint 2/3/4 file lists. (Supabase JS is untyped here — expect qa to actually stay green; runtime breakage is caught by later sprints' tests.)

**Gate:** migration applies + seed loads + `npm run qa` green.

---

## Sprint 2 — Admin API (sonnet)

**Files (from inventory; at minimum):**
- DELETE: `src/app/api/admin/seasons/route.ts`, `.../seasons/[id]/current/route.ts`, `.../seasons/[id]/archive/route.ts`
- NEW: `src/app/api/admin/leagues/[id]/seasons/route.ts`, `.../seasons/[seasonId]/current/route.ts`, `.../seasons/[seasonId]/archive/route.ts` — reuse the existing route patterns (`withAdminGuard`, zod schema, service-role client, audit log calls) from the deleted routes.
- MODIFY: `src/app/api/admin/leagues/route.ts` (drop `season_id` from create schema), `.../leagues/[id]/drivers/route.ts`, `.../leagues/[id]/sessions/route.ts`, `.../leagues/[id]/wheel/spin/route.ts`, `.../leagues/[id]/circuit-pool/route.ts` (remove the dead `season_id` select), `.../leagues/[id]/carry-over/route.ts` (decision 4).
- Add one shared helper `src/lib/leagues/get-current-season.ts`: `getCurrentSeason(db, leagueId)` → season row or null. All modified routes use it — no per-route copies.

**Tests:** update `src/__tests__/unit/s8-admin.test.ts`, `s3-admin.test.ts`, `s6-calendar.test.ts`, and any other unit test hitting the changed routes. New tests: league with no current season → 409 on add-driver/create-session; season from another league → rejected; carry-over flips is_current.

**Gate:** `npm run qa` green.

---

## Sprint 3 — Admin UI (sonnet for pages with logic, haiku for mechanical threading)

**sonnet tasks:**
- MODIFY `src/app/admin/leagues/[id]/page.tsx`: season section (list league's seasons, create form, set-current, archive, carry-over — move `CarryOverForm` usage here). Default displayed season = league's current season; keep `?season_id=` override; drop the global-`is_current` fallback rung.
- DELETE `src/app/admin/seasons/page.tsx`, `src/app/admin/seasons/[id]/page.tsx`; remove the nav link (find it in the admin layout/nav component).
- MODIFY `src/components/admin/SeasonActions.tsx` (or replace with league-scoped equivalent), league create form (remove season picker), `src/app/admin/leagues/[id]/transfers/new/page.tsx`, `.../adjustments/page.tsx`, `src/app/admin/import/page.tsx` + `src/components/admin/ImportForm.tsx` (season dropdown now lists the selected league's seasons).

**haiku tasks (after sonnet's changes land):** thread renamed props/params through any child components; update component tests that mirror those components 1:1 (`add-league-driver-form.test.tsx`, `transfer-form.test.tsx`, `session-form.test.tsx`, etc. — per inventory).

**Gate:** `npm run qa` green.

---

## Sprint 4 — Public pages + import service (sonnet)

**Files:**
- `src/lib/public/resolve-league.ts` — resolve current season via `seasons.league_id + is_current` instead of the dropped `leagues.season_id` FK join.
- `src/lib/public/resolve-league-seasons.ts` — fallback season = league's current season; derived-from-sessions logic unchanged.
- `src/app/page.tsx`, `src/app/leagues/[slug]/**` pages — only where they read the league→season join; the `(league_id, season_id)` filters stay as-is.
- `src/lib/import/import-service.ts`, `src/app/api/admin/import/route.ts`, `.../import/confirm/route.ts` — validate the target season belongs to the target league; keyed behavior `(league_id, season_id)` otherwise unchanged.
- `src/lib/results/publish-service.ts`, `src/lib/penalties/get-driver-penalty-totals.ts` — verify (likely no change; they receive explicit season_id).

**Tests:** update `s4-public.test.ts`, `s9-import.test.ts`, `home-page.test.tsx`, `public-page-metadata.test.ts`, others per inventory.

**Gate:** `npm run qa` green.

---

## Sprint 5 — E2E + full regression (sonnet, haiku assists)

**Tasks:**
1. haiku: update e2e specs per inventory (`admin-league-setup.spec.ts`, `lifecycle.spec.ts`, `wheel-spin.spec.ts`, `results-publish.spec.ts`, `adjustments.spec.ts`, `public-pages.spec.ts`, …) to the new flow: create league → add season → set current → proceed. `scripts/seed-e2e.mjs` already updated in Sprint 1 — verify.
2. sonnet: add ONE new e2e spec `e2e/season-rollover.spec.ts`: create league → Season 1 → race data → carry-over to Season 2 → assert new sessions land in Season 2 and public page defaults to Season 2 with Season 1 still reachable via selector. (This is the bug the old model shipped; it gets a permanent regression test.)
3. sonnet: run `npm run sprint-verify` and fix everything until green.
4. haiku: update `dev docs/HANDOVER.md` — replace the season-model section (~line 197–214) and the fallback-chain note (~line 205) with the new model; delete `dev docs/season-flip-inventory.md`.

**Gate (final):** `npm run sprint-verify` green + `npm run deploy:check` green.

---

## Orchestrator rules

- One sprint = one agent run (Sprint 3 = sonnet run, then haiku run). Pass this file + the inventory to every agent. Agents report changed files with line refs; orchestrator spot-checks against the locked decisions before running the gate.
- An agent that wants to deviate from a locked decision must stop and report — not improvise.
- No sprint touches files outside its list except test files broken by its own changes.
- Never skip a gate. If a gate fails twice after fixes, escalate to the orchestrator (main session) instead of a third blind attempt.
- Prod deploy: migration in Sprint 1 is written against real data (decision 3). Before merging to `main`, orchestrator confirms with the user that a Supabase backup/PITR point exists.
