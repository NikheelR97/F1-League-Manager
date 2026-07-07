-- F2 (audit4): two concurrent identical transfer POSTs both read the same
-- "one open stint" for a driver, both pass validation, and both insert a new
-- open stint — the driver ends up with two rows in driver_team_stints where
-- ends_on is null. There was no lock or constraint enforcing the invariant
-- "at most one open stint per league_driver_entry", only application code
-- that assumes it. Confirmed live via e2e/lifecycle.spec.ts T15.
--
-- A driver legitimately has at most one open stint at a time (every prior
-- stint has ends_on set when a new one opens), so this partial unique index
-- matches correct data exactly and only rejects the race.
create unique index if not exists driver_team_stints_one_open_per_entry
  on public.driver_team_stints (league_driver_entry_id)
  where ends_on is null;
