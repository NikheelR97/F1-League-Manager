# Product

## Register

product

## Users

Two distinct populations with asymmetric friction tolerance:

- **Racers / public visitors** — non-technical league members checking standings, results, calendar, and wheel history, often on a phone between races or right after a session. One confusing experience and they stop checking.
- **Admins (league organizers)** — a handful of people doing repetitive weekly data entry (qualifying, race results, penalties, transfers, wheel spins), often at night right after a session under time pressure. Captive users: friction costs time and causes data-entry errors every week rather than abandonment.
- **Racers (authenticated)** — private vehicle setup garage management.

## Product Purpose

Replace a spreadsheet-driven F1 esports league workflow (`4QM8 F1 2025 Season 2.xlsx`) with a fast, secure web app: public championship standings and results, an admin panel for league operations, and a one-time workbook migration after which the app is the source of truth. Success = the weekly race-night admin ritual is faster and less error-prone than the workbook, and racers actually check the site.

## Brand Personality

Modern F1 race-control product: dark, sharp, premium, data-rich, fast.

- Public "Race Weekend" theme: dark graphite, red accents, white/silver data, team-color chips.
- Admin "Race Control" theme: dense, clear, operational, fewer decorations.
- Racer "Driver Garage" theme: focused setup management.
- Fonts: Titillium Web (headings/body), JetBrains Mono (numbers/times/points).

## Anti-references

- No official F1 logos, protected broadcast graphics, or unlicensed assets.
- Not spreadsheet-like: no huge single-form data entry, no sluggish pages.
- Mobile tables must not be squeezed wide tables — use cards or expandable rows.

## Design Principles

1. **The tool disappears into the task** — admins are in a weekly ritual; earned familiarity over novelty.
2. **Data is the interface** — standings, gaps, and points are the content; monospace numerics, clear hierarchy.
3. **Server truth, visible state** — every publish/spin/import confirms what happened; users never guess whether it worked.
4. **Respect the asymmetry** — racers get zero-friction discoverability; admins get keyboard-fast dense entry.
5. **Context always visible** — league, season, round, and last-updated on every public results/standings page.

## Accessibility & Inclusion

WCAG AA minimum (4.5:1 body text contrast, 3:1 large text), keyboard-completable admin flows, visible focus rings, `aria-live` for async state (wheel, publish), reduced-motion alternatives for wheel/countdown animation, team colors never the sole carrier of meaning.
