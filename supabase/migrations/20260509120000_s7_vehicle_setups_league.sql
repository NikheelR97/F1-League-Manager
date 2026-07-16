-- S7 racer garage: add league_id to vehicle_setups for filtering.
-- All existing setups have league_id = null (unfiled).

alter table public.vehicle_setups
  add column league_id uuid references public.leagues (id) on delete set null;

create index vehicle_setups_league_idx on public.vehicle_setups (driver_id, league_id);
