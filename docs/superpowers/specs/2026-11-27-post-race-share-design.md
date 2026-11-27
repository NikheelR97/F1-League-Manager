# Post-race standings: combined card + downloadable recap image

Date: 2026-11-27 · Status: awaiting approval

## Why
The busiest moment on the site is Thursday night after the race. Drivers and the
league owner open Standings on a computer, screenshot it and post it to WhatsApp.
Today that takes two screenshots (drivers and constructors are separate pages),
and nothing in the image shows what changed this round.

## Goals
- **A. Combined standings card** at `/leagues/[slug]/standings`: one screenshot
  covers both championships, plus what changed this round.
- **C. Round recap image**: a fixed-size PNG the owner downloads with one click
  and drops into WhatsApp.

## Non-goals
- Phone-first layout for the card (screenshots are taken on a computer; the card
  still has to stay readable on phones).
- Auto-posting to WhatsApp, scheduling, or editing the image.
- Redesigning the other public pages (hub, results, driver pages). That comes later,
  separately.

## Anti-goals
- A screenshot that crops drivers out of the full table (A keeps all drivers).
- Numbers in the image that disagree with standings (BigT's cap must be applied
  everywhere).

## Approaches considered (image)
1. **Server-rendered PNG with `next/og` `ImageResponse`**: chosen. Already part of
   Next.js, no new package, runs on Vercel, identical output every time.
2. Browser-side DOM-to-image library: dropped (new package, output depends on browser and fonts).
3. Headless-browser screenshot service: dropped (heavy, doesn't run well on Vercel).

The combined card has one sensible approach: a new server page reusing existing standings data.

## Design

### A. Combined card (`/standings`)
- Replace the redirect in `src/app/leagues/[slug]/standings/page.tsx` with a page
  rendering one `StandingsCard` titled "Championship standings".
- Header: Season · "After Round N · <last round name>" · league name · updated date.
- Strip under the header: last round's feature-race podium (P1–P3, podium colours),
  plus "Next: <circuit> · <SAST date>" when a session is scheduled.
- Body: two columns on md+ (drivers ~60%, constructors ~40%), stacked on mobile.
  - Drivers (all rows): Pos, movement arrow (from `previous_position`), Driver,
    team colour bar, **+Rnd**, Pts, Gap.
  - Constructors (all rows): Pos, movement arrow, team, +Rnd, Pts.
- **+Rnd** = Σ(`points_awarded + manual_points_adjustment`) over `race_results` of all
  completed sessions on the last round's SAST day (sprint + feature), per driver;
  per team via `race_results.team_id`. Season-level `championship_adjustments` are
  not part of +Rnd.
- Season selector and Drivers/Constructors toggle stay above the card (outside the screenshot area).
  The toggle gains an "Overview" tab for this page.
- Search box is not shown on this page.

### C. Round recap
- Page `/leagues/[slug]/recap` (linked from the Standings tabs and the hub's last-result card):
  shows a preview `<img>` of the PNG and a **Download image** button
  (`<a download="thursday-league-round-19.png">`).
- Image route `/leagues/[slug]/recap/image.png` (route handler returning
  `ImageResponse`, 1200×1200, `Cache-Control` revalidated on the standings cache tag
  / short max-age).
- Layout (dark theme, F1 red accent, podium colours):
  header "Round N · <race>" + league/season; large podium P1–P3 with points;
  three columns: Top 10 drivers (pos, name, pts), Top 5 constructors, Movers
  (top 3 climbers/fallers by `previous_position - position`, hidden if none);
  footer "Next: <race> · <date> 21:00 SAST" and site address.
- Fonts: Titillium Web Bold and JetBrains Mono Bold TTFs (OFL) committed under
  `src/app/leagues/[slug]/recap/fonts/` and loaded with `fs`/`fetch(new URL(...))`.
- Public (same visibility as standings); no auth.

### Shared data
- One helper `src/lib/public/round-summary.ts` returns { round number, last round
  name, podium, +Rnd per driver/team, movers, next session } for (league, season).
  Uses `leagueRoundNumbers` for N. Unit-tested (sprint+feature summed, cap applied,
  DNS ignored, no completed rounds → null).

## Edge cases
- No completed rounds: card shows standings without strip/+Rnd; recap page shows
  "No completed rounds yet" and no download button.
- Ties: keep existing "TIED" gap text; tie-break note in footer.
- Long names: truncate with ellipsis in both card and image.

## Builder's calls (mine, flagged for review)
- Image size 1200×1200 (square posts well in WhatsApp).
- Movers = top 3 each way; constructors +Rnd included.
- Old `/standings/drivers` and `/standings/constructors` pages unchanged apart from the extra tab.

## Release
Feature branch → PR to `dev` → promote PR to `prod` (owner merges).
