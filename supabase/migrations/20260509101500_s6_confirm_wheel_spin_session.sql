create or replace function public.confirm_wheel_spin_session(
  target_league_id uuid,
  target_season_id uuid,
  target_wheel_spin_id uuid,
  target_circuit_id uuid,
  target_points_system_id uuid,
  target_name text,
  target_session_code text,
  target_race_number integer,
  target_race_length_percent integer,
  target_scheduled_at timestamptz,
  actor_id uuid
)
returns table (id uuid, name text, session_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_session_id uuid;
begin
  if not exists (
    select 1
    from public.points_systems
    where points_systems.id = target_points_system_id
      and points_systems.league_id = target_league_id
  ) then
    raise exception 'Points system does not belong to league' using errcode = 'P0001';
  end if;

  update public.wheel_spins
  set
    status = 'confirmed',
    confirmed_at = now(),
    confirmed_by = actor_id
  where wheel_spins.id = target_wheel_spin_id
    and wheel_spins.league_id = target_league_id
    and wheel_spins.season_id = target_season_id
    and wheel_spins.circuit_id = target_circuit_id
    and wheel_spins.status = 'pending'
  returning wheel_spins.race_session_id into inserted_session_id;

  if not found then
    raise exception 'Wheel spin is not pending for this league and circuit' using errcode = 'P0001';
  end if;

  if inserted_session_id is not null then
    raise exception 'Wheel spin is already linked to a session' using errcode = 'P0001';
  end if;

  insert into public.race_sessions (
    circuit_id,
    league_id,
    name,
    points_system_id,
    race_length_percent,
    race_number,
    scheduled_at,
    season_id,
    session_code
  )
  values (
    target_circuit_id,
    target_league_id,
    target_name,
    target_points_system_id,
    target_race_length_percent,
    target_race_number,
    target_scheduled_at,
    target_season_id,
    target_session_code
  )
  returning race_sessions.id into inserted_session_id;

  update public.wheel_spins
  set race_session_id = inserted_session_id
  where wheel_spins.id = target_wheel_spin_id;

  update public.league_circuit_pools
  set
    is_available = false,
    used_at = now()
  where league_circuit_pools.league_id = target_league_id
    and league_circuit_pools.circuit_id = target_circuit_id
    and league_circuit_pools.used_at is null;

  if not found then
    raise exception 'Circuit is not available in this league pool' using errcode = 'P0001';
  end if;

  return query
    select race_sessions.id, race_sessions.name, race_sessions.session_code
    from public.race_sessions
    where race_sessions.id = inserted_session_id;
end;
$$;

revoke all on function public.confirm_wheel_spin_session(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  integer,
  integer,
  timestamptz,
  uuid
) from public;

grant execute on function public.confirm_wheel_spin_session(
  uuid,
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  text,
  integer,
  integer,
  timestamptz,
  uuid
) to service_role;
