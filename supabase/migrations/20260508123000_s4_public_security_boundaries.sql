-- S4 public read hardening.
-- Public visitors may read published league data, but draft leagues and
-- steward/appeal audit fields must not be exposed through the anon API.

create or replace function public.is_public_league(target_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.leagues
    where id = target_league_id
      and status <> 'draft'
  );
$$;

revoke all on function public.is_public_league(uuid) from public;
grant execute on function public.is_public_league(uuid) to anon, authenticated;

drop policy if exists public_read_leagues on public.leagues;
create policy public_read_leagues on public.leagues
  for select using (status <> 'draft');

drop policy if exists public_read_points_systems on public.points_systems;
create policy public_read_points_systems on public.points_systems
  for select using (public.is_public_league(league_id));

drop policy if exists public_read_teams on public.teams;
create policy public_read_teams on public.teams
  for select using (public.is_public_league(league_id));

drop policy if exists public_read_drivers on public.drivers;
create policy public_read_drivers on public.drivers
  for select using (
    exists (
      select 1
      from public.league_driver_entries lde
      where lde.driver_id = drivers.id
        and public.is_public_league(lde.league_id)
    )
  );

drop policy if exists public_read_driver_entries on public.league_driver_entries;
create policy public_read_driver_entries on public.league_driver_entries
  for select using (public.is_public_league(league_id));

drop policy if exists public_read_driver_team_stints on public.driver_team_stints;
create policy public_read_driver_team_stints on public.driver_team_stints
  for select using (
    exists (
      select 1
      from public.league_driver_entries lde
      where lde.id = driver_team_stints.league_driver_entry_id
        and public.is_public_league(lde.league_id)
    )
  );

drop policy if exists public_read_reserve_assignments on public.race_reserve_assignments;
create policy public_read_reserve_assignments on public.race_reserve_assignments
  for select using (
    exists (
      select 1
      from public.race_sessions rs
      where rs.id = race_reserve_assignments.race_session_id
        and rs.status in ('scheduled', 'completed')
        and public.is_public_league(rs.league_id)
    )
  );

drop policy if exists public_read_circuit_pools on public.league_circuit_pools;
create policy public_read_circuit_pools on public.league_circuit_pools
  for select using (public.is_public_league(league_id));

drop policy if exists public_read_race_sessions on public.race_sessions;
create policy public_read_race_sessions on public.race_sessions
  for select using (
    status in ('scheduled', 'completed')
    and public.is_public_league(league_id)
  );

drop policy if exists public_read_wheel_spins on public.wheel_spins;
create policy public_read_wheel_spins on public.wheel_spins
  for select using (
    status = 'confirmed'
    and public.is_public_league(league_id)
  );

drop policy if exists public_read_qualifying_results on public.qualifying_results;
create policy public_read_qualifying_results on public.qualifying_results
  for select using (
    exists (
      select 1
      from public.race_sessions rs
      where rs.id = qualifying_results.race_session_id
        and rs.status = 'completed'
        and public.is_public_league(rs.league_id)
    )
  );

drop policy if exists public_read_race_results on public.race_results;
create policy public_read_race_results on public.race_results
  for select using (
    exists (
      select 1
      from public.race_sessions rs
      where rs.id = race_results.race_session_id
        and rs.status = 'completed'
        and public.is_public_league(rs.league_id)
    )
  );

drop policy if exists public_read_penalties on public.penalties;
create policy public_read_penalties on public.penalties
  for select using (public.is_public_league(league_id));

drop policy if exists public_read_championship_adjustments on public.championship_adjustments;
create policy public_read_championship_adjustments on public.championship_adjustments
  for select using (public.is_public_league(league_id));

drop policy if exists public_read_driver_penalty_totals on public.driver_penalty_totals;
create policy public_read_driver_penalty_totals on public.driver_penalty_totals
  for select using (public.is_public_league(league_id));

drop policy if exists public_read_driver_standings on public.driver_standings;
create policy public_read_driver_standings on public.driver_standings
  for select using (public.is_public_league(league_id));

drop policy if exists public_read_team_standings on public.team_standings;
create policy public_read_team_standings on public.team_standings
  for select using (public.is_public_league(league_id));

revoke select on table public.penalties from anon, authenticated;
grant select (
  id,
  league_id,
  season_id,
  driver_id,
  race_session_id,
  penalty_points,
  reason,
  status,
  created_at
) on public.penalties to anon, authenticated;
