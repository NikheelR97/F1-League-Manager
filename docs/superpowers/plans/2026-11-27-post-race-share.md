# Post-race Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Combined drivers+constructors standings card at `/standings` and a downloadable 1200×1200 round-recap PNG.

**Architecture:** A pure `buildRoundSummary` (tested) plus a thin Supabase loader feed both a new server page (`/standings`) and an `ImageResponse` route (`/recap/image.png`). A `/recap` page previews the PNG with a download link.

**Tech Stack:** Next.js 16 App Router, `next/og` ImageResponse, Supabase (service-role client), Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-27-post-race-share-design.md`

## Global Constraints
- No new npm dependencies.
- Points per row = `points_awarded + manual_points_adjustment` (applies BigT's cap); season `championship_adjustments` not in +Rnd.
- A "round" = all completed sessions on the same SAST day (`leagueRoundNumbers`).
- Image is 1200×1200 PNG; fonts Titillium Web Bold + JetBrains Mono Bold TTF (OFL) committed in repo.
- Public pages; service-role reads only; existing `cacheTag.standings(league.id)` for caching.
- Branch `feat/post-race-share` from `origin/dev`; PR to `dev`; promote PR to `prod` (owner merges).

## Review Focus
- Round with sprint + feature: +Rnd sums both → test in Task 1.
- Driver with negative race-day adj (BigT 25 − 7) → +Rnd 18 → test in Task 1.
- No completed sessions in season → summary `null`, page renders standings without strip, recap shows empty state → test in Task 1; manual check Task 4.
- DNS/DSQ rows with 0 pts still count as 0 not missing; drivers absent from round show `+0` → test in Task 1.
- Movers when `previous_position` is null (first round) → excluded → test in Task 1.

---

### Task 1: Round summary helper

**Files:**
- Create: `src/lib/public/round-summary.ts`
- Test: `src/__tests__/unit/round-summary.test.ts`

**Interfaces:**
- Produces:
```ts
export type SummarySession = { id: string; name: string; scheduled_at: string | null; race_number: number | null; circuit: string | null };
export type SummaryResult = { race_session_id: string; driver_id: string; team_id: string; finishing_position: number | null; points_awarded: number; manual_points_adjustment: number; driver_name: string };
export type StandingRow = { id: string; position: number; previous_position: number | null; name: string };
export type RoundSummary = {
  roundNumber: number; roundName: string;           // name of the feature (lowest race_number) session on that day
  podium: { position: 1 | 2 | 3; driverName: string; points: number }[]; // feature session, points = pts+adj
  driverRoundPoints: Map<string, number>; teamRoundPoints: Map<string, number>;
  movers: { up: { name: string; delta: number }[]; down: { name: string; delta: number }[] }; // top 3 each, delta = previous - position, nulls/0 excluded
};
export function buildRoundSummary(completed: SummarySession[], results: SummaryResult[], drivers: StandingRow[]): RoundSummary | null;
export async function loadRoundSummary(leagueId: string, seasonId: string): Promise<{ summary: RoundSummary | null; nextSession: { circuit: string | null; scheduled_at: string } | null }>;
```

- [ ] **Step 1: Write failing tests** for `buildRoundSummary`:
  - `returns null with no completed sessions`
  - `sums sprint and feature on the same SAST day` (sprint 8 + feature 25 → 33; earlier day's results ignored)
  - `applies manual adjustment` (25, −7 → 18)
  - `podium comes from the feature session (race_number 1)`
  - `team points sum both drivers` 
  - `movers exclude null previous_position and zero deltas; max 3 each way, largest first`
  - `roundNumber equals number of distinct SAST days`
- [ ] **Step 2:** `npx vitest run src/__tests__/unit/round-summary.test.ts` → FAIL (module missing).
- [ ] **Step 3: Implement** `buildRoundSummary` (pure; last day = max SAST day of `completed`, reuse `leagueRoundNumbers`). Implement `loadRoundSummary` querying `race_sessions` (status completed, season), `race_results` for that day's session ids joined `drivers(display_name)`, `driver_standings` (position, previous_position, drivers), and next scheduled session (`status='scheduled'`, earliest `scheduled_at`, `circuits(name)`).
- [ ] **Step 4:** test → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5: Commit** `feat(public): round summary helper`.

### Task 2: Combined standings card at `/standings`

**Files:**
- Modify: `src/app/leagues/[slug]/standings/page.tsx` (replace redirect)
- Modify: `src/components/league/StandingsTabs.tsx` (add `"overview"` → `/standings`)
- Modify: `src/app/leagues/[slug]/standings/{drivers,constructors}/page.tsx` only if tab prop type changes.

**Interfaces:** Consumes `loadRoundSummary`. `StandingsTabs` `active: "overview" | "drivers" | "constructors"`; overview href `/leagues/${slug}/standings?season=…`.

- [ ] **Step 1:** Build page: season resolution copied from drivers page; fetch driver_standings (limit 50) + team_standings (limit 15) via `unstable_cache` with `cacheTag.standings`; `StandingsCard` title "Championship standings", `lastRound` = `Round N · roundName`.
- [ ] **Step 2:** Strip under header: podium (gold/silver/bronze classes) + `Next: circuit · formatRaceDateTimeSAST(...)`; hidden when summary null and no next session.
- [ ] **Step 3:** Body `grid md:grid-cols-[3fr_2fr]`; drivers table: Pos, `PositionDelta compact`, Driver(link), team bar, +Rnd (`+n`, green when >0, muted when 0), Pts, Gap(`formatGap`); constructors: Pos, delta, team bar+name, +Rnd, Pts. Long names `truncate`.
- [ ] **Step 4:** Verify: `npx tsc --noEmit`, `npx eslint` on changed files, existing `vitest run` passes; screenshot `/leagues/thursday-super-league/standings` on Vercel preview at 1280 wide, all rows visible.
- [ ] **Step 5: Commit** `feat(standings): combined championship card`.

### Task 3: Recap PNG route

**Files:**
- Create: `src/app/leagues/[slug]/recap/image.png/route.tsx`
- Create: `src/app/leagues/[slug]/recap/fonts/TitilliumWeb-Bold.ttf`, `JetBrainsMono-Bold.ttf` (download from Google Fonts GitHub repos, OFL)

**Interfaces:** `GET(req, { params: Promise<{ slug: string }> })` → `ImageResponse` 1200×1200, `export const runtime = "nodejs"`; 404 when league unknown. Fonts read with `readFile(join(process.cwd(), "src/app/leagues/[slug]/recap/fonts/…"))`; add the font dir to `outputFileTracingIncludes` in `next.config` for that route.

- [ ] **Step 1:** Layout per spec: header "Round N · roundName" + "League · Season"; podium row (3 large blocks, podium colours, pts); three columns Top 10 drivers / Top 5 constructors / Movers (omit column if none); footer next race + site label. Background `#15151e`, red `#e10600` accent bar. Null summary → simple "No completed rounds yet" image.
- [ ] **Step 2:** Response header `Cache-Control: public, max-age=60`.
- [ ] **Step 3:** Verify locally against preview: `curl -s -o r.png -w "%{http_code} %{content_type}" <preview>/leagues/thursday-super-league/recap/image.png` → `200 image/png`; open PNG and eyeball.
- [ ] **Step 4: Commit** `feat(recap): round recap image`.

### Task 4: Recap page + links

**Files:**
- Create: `src/app/leagues/[slug]/recap/page.tsx`
- Modify: `src/components/league/StandingsTabs.tsx` (add "Recap" link at right), `src/components/league/LeagueHub.tsx` (last-result card: "Share recap →" link)

- [ ] **Step 1:** Page: title "Round recap", `<img src="./recap/image.png?season=…" width=600 height=600 alt="Round N recap">`, `<a download="${slug}-round-${N}.png" href=…>Download image</a>` styled as primary button; empty state when summary null (no button).
- [ ] **Step 2:** Verify on preview: button downloads a PNG; hub link and tab link navigate to `/recap`.
- [ ] **Step 3:** Full `npx vitest run`, `npx tsc --noEmit`, lint. Commit `feat(recap): recap page and links`.

### Task 5: Release
- [ ] Push branch, PR → `dev`, wait for CI green, squash-merge.
- [ ] Promote branch from `origin/prod` with `read-tree` of `origin/dev`, empty diff vs dev, PR → `prod`; owner merges.
- [ ] After deploy: screenshot prod `/standings` and download prod recap PNG; send both to the user.
