# F1 Esports League Manager

Production-grade F1 esports league management app.

## Current Status

Sprint 7, Racer Garage, is merged to `dev`.

Latest merged feature PR:

```text
PR #11 - feat(s7): racer garage - private setup CRUD, duplicate, filters
```

Current next sprint:

```text
S8 - Admin Operations, Seasons, Carry-Overs, And Audit
```

Latest local migrations required:

```text
supabase/migrations/20260509120000_s7_vehicle_setups_league.sql
supabase/migrations/20260509130000_fix_driver_standings_team_id.sql
```

Default development database target:

```text
local Supabase
```

Shared previews and staging use:

```text
f1-league-manager-nonprod
```

Production uses:

```text
f1-league-manager-prod
```

## Scripts

```bash
npm run dev
npm run type-check
npm run lint
npm run test
npm run test:coverage
npm run build
npm run test:e2e
npm run sprint-verify
```

## Documentation

Project planning lives in:

```text
dev docs/HANDOVER.md
dev docs/SPRINT_PLAN.md
dev docs/PREREQUISITES.md
```

Follow the branch, PR, review, and sprint-tracking rules in those documents before merging any code.
