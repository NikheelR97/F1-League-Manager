-- M4 — "no team / free agent" is a real state: a driver transferred off a
-- team's roster (or never assigned one) can still be entered in a race
-- result. Their points must count for the driver but for no constructor.
-- Additive/non-destructive: relaxes the NOT NULL constraint only, existing
-- rows are untouched.
alter table public.race_results
  alter column team_id drop not null;
