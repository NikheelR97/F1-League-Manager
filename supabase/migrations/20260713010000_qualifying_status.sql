-- M6 — a driver disqualified or banned in qualifying had no way to be
-- recorded as such: qualifying_results only ever stored a position, so a
-- DSQ/BAN was indistinguishable from a DNS (both just left the driver's row
-- absent). Adds an explicit status column, reusing the existing
-- race_result_status enum (already used by race_results) so the same
-- <ResultStatus> display component works for qualifying too.
alter table public.qualifying_results
  add column qualifying_status public.race_result_status not null default 'classified';

-- A DSQ/BAN driver may have no numeric qualifying position to record.
-- Additive/non-destructive: existing rows already all have a position, so
-- dropping NOT NULL doesn't touch them. The existing range check already
-- passes NULL through untouched (a check constraint only rejects an
-- expression that evaluates to false, and `null between 1 and 20` is null,
-- not false) — no need to redefine it.
alter table public.qualifying_results
  alter column qualifying_position drop not null;
