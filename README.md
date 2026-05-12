# F1 Esports League Manager

Production-grade F1 esports league management app.

## Current Status

Sprint 6, Calendar and Digital Wheel, is merged to `dev`.

Latest merged feature PR:

```text
PR #10 - feat(s6): calendar and digital wheel
```

Current next sprint:

```text
S7 - Racer Garage
```

Latest local migration required for S6:

```text
supabase/migrations/20260509101500_s6_confirm_wheel_spin_session.sql
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
