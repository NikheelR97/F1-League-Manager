-- S1 core schema, RLS, storage buckets, and reference data.
-- 2025 calendar source: https://corp.formula1.com/fia-and-formula-1-announces-2025-calendar/

create extension if not exists pgcrypto with schema extensions;

create type public.profile_role as enum ('racer', 'admin', 'super_admin');
create type public.league_status as enum ('draft', 'active', 'archived');
create type public.league_format as enum ('informal', 'standard', 'custom');
create type public.team_kind as enum ('official', 'custom');
create type public.session_status as enum ('scheduled', 'in_progress', 'completed', 'cancelled');
create type public.race_result_status as enum ('classified', 'dnf', 'dns', 'dsq', 'ban');
create type public.penalty_status as enum ('open', 'served', 'appealed', 'rescinded');
create type public.adjustment_kind as enum ('bonus', 'penalty', 'correction');
create type public.wheel_spin_status as enum ('pending', 'confirmed', 'void');
create type public.workbook_migration_status as enum ('draft', 'confirmed', 'void');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  role public.profile_role not null default 'racer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  starts_on date not null,
  ends_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  constraint seasons_date_order check (ends_on is null or ends_on >= starts_on)
);

create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  format public.league_format not null default 'custom',
  status public.league_status not null default 'draft',
  season_id uuid not null references public.seasons (id) on delete restrict,
  created_by uuid references public.profiles (id) on delete set null,
  fastest_lap_enabled boolean not null default true,
  pole_position_enabled boolean not null default false,
  constructor_championship_enabled boolean not null default true,
  penalty_threshold integer not null default 12 check (penalty_threshold between 1 and 99),
  logo_path text,
  hero_image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.points_systems (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  points_by_position jsonb not null,
  fastest_lap_points integer not null default 1 check (fastest_lap_points between 0 and 10),
  pole_position_points integer not null default 0 check (pole_position_points between 0 and 10),
  max_positions integer not null default 10 check (max_positions between 1 and 20),
  created_at timestamptz not null default now(),
  constraint points_systems_points_object check (jsonb_typeof(points_by_position) = 'object')
);

create table public.official_team_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null unique check (sort_order between 1 and 20)
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  official_template_id uuid references public.official_team_templates (id) on delete set null,
  name text not null check (char_length(name) between 1 and 100),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  kind public.team_kind not null default 'custom',
  color_hex text not null check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  logo_path text,
  car_image_path text,
  created_at timestamptz not null default now(),
  unique (league_id, slug)
);

create table public.drivers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  racing_number integer check (racing_number between 1 and 999),
  country text check (char_length(country) between 2 and 80),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.league_driver_entries (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete restrict,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  is_reserve boolean not null default false,
  joined_on date not null default current_date,
  left_on date,
  carry_over_penalty_points integer not null default 0 check (carry_over_penalty_points >= 0),
  carry_over_ban_count integer not null default 0 check (carry_over_ban_count >= 0),
  created_at timestamptz not null default now(),
  unique (league_id, season_id, driver_id),
  constraint league_driver_entries_dates check (left_on is null or left_on >= joined_on)
);

create table public.driver_team_stints (
  id uuid primary key default gen_random_uuid(),
  league_driver_entry_id uuid not null references public.league_driver_entries (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete restrict,
  starts_on date not null,
  ends_on date,
  transfer_reason text check (transfer_reason is null or char_length(transfer_reason) <= 240),
  created_at timestamptz not null default now(),
  constraint driver_team_stints_dates check (ends_on is null or ends_on >= starts_on)
);

create table public.circuits (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  country text not null check (char_length(country) between 2 and 80),
  venue text not null check (char_length(venue) between 1 and 100),
  grand_prix_name text not null check (char_length(grand_prix_name) between 1 and 120),
  round_number integer unique check (round_number between 1 and 24),
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  constraint circuits_date_order check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.league_circuit_pools (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  circuit_id uuid not null references public.circuits (id) on delete restrict,
  is_available boolean not null default true,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (league_id, circuit_id)
);

create table public.race_sessions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete restrict,
  circuit_id uuid not null references public.circuits (id) on delete restrict,
  points_system_id uuid not null references public.points_systems (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  session_code text not null check (session_code ~ '^[A-Z0-9]{6}$'),
  race_number integer not null default 1 check (race_number between 1 and 2),
  race_length_percent integer not null check (race_length_percent in (25, 50, 100)),
  scheduled_at timestamptz not null,
  status public.session_status not null default 'scheduled',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (league_id, session_code)
);

create table public.race_reserve_assignments (
  id uuid primary key default gen_random_uuid(),
  race_session_id uuid not null references public.race_sessions (id) on delete cascade,
  original_driver_id uuid not null references public.drivers (id) on delete restrict,
  reserve_driver_id uuid not null references public.drivers (id) on delete restrict,
  team_id uuid not null references public.teams (id) on delete restrict,
  assigned_by uuid references public.profiles (id) on delete set null,
  reason text check (reason is null or char_length(reason) <= 240),
  created_at timestamptz not null default now(),
  unique (race_session_id, original_driver_id)
);

create table public.wheel_spins (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete restrict,
  circuit_id uuid not null references public.circuits (id) on delete restrict,
  race_session_id uuid references public.race_sessions (id) on delete set null,
  status public.wheel_spin_status not null default 'pending',
  spun_by uuid references public.profiles (id) on delete set null,
  confirmed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table public.qualifying_results (
  id uuid primary key default gen_random_uuid(),
  race_session_id uuid not null references public.race_sessions (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete restrict,
  team_id uuid not null references public.teams (id) on delete restrict,
  qualifying_position integer not null check (qualifying_position between 1 and 20),
  is_pole boolean not null default false,
  created_at timestamptz not null default now(),
  unique (race_session_id, driver_id),
  unique (race_session_id, qualifying_position)
);

create table public.race_results (
  id uuid primary key default gen_random_uuid(),
  race_session_id uuid not null references public.race_sessions (id) on delete cascade,
  driver_id uuid not null references public.drivers (id) on delete restrict,
  team_id uuid not null references public.teams (id) on delete restrict,
  finishing_position integer check (finishing_position between 1 and 20),
  result_status public.race_result_status not null default 'classified',
  raw_result text check (raw_result is null or char_length(raw_result) <= 80),
  fastest_lap boolean not null default false,
  points_awarded integer not null default 0 check (points_awarded between 0 and 200),
  penalty_points integer not null default 0 check (penalty_points >= 0),
  manual_points_adjustment integer not null default 0 check (manual_points_adjustment between -200 and 200),
  notes text check (notes is null or char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  unique (race_session_id, driver_id),
  unique (race_session_id, finishing_position)
);

create table public.penalties (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete restrict,
  driver_id uuid not null references public.drivers (id) on delete restrict,
  race_session_id uuid references public.race_sessions (id) on delete set null,
  penalty_points integer not null check (penalty_points between 0 and 99),
  reason text not null check (char_length(reason) between 1 and 500),
  status public.penalty_status not null default 'open',
  steward_notes text check (steward_notes is null or char_length(steward_notes) <= 1000),
  appeal_notes text check (appeal_notes is null or char_length(appeal_notes) <= 1000),
  issued_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.championship_adjustments (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete restrict,
  driver_id uuid references public.drivers (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  adjustment_kind public.adjustment_kind not null,
  points_delta integer not null check (points_delta between -200 and 200),
  reason text not null check (char_length(reason) between 1 and 500),
  applied_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint championship_adjustments_one_target check (
    (driver_id is not null and team_id is null)
    or (driver_id is null and team_id is not null)
  )
);

create table public.driver_penalty_totals (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete restrict,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  penalty_points integer not null default 0 check (penalty_points >= 0),
  ban_threshold_reached boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (league_id, season_id, driver_id)
);

create table public.driver_standings (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete restrict,
  driver_id uuid not null references public.drivers (id) on delete cascade,
  position integer not null check (position between 1 and 50),
  previous_position integer check (previous_position between 1 and 50),
  total_points integer not null default 0,
  wins integer not null default 0 check (wins >= 0),
  podiums integer not null default 0 check (podiums >= 0),
  fastest_laps integer not null default 0 check (fastest_laps >= 0),
  updated_at timestamptz not null default now(),
  unique (league_id, season_id, driver_id),
  unique (league_id, season_id, position)
);

create table public.team_standings (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete restrict,
  team_id uuid not null references public.teams (id) on delete cascade,
  position integer not null check (position between 1 and 15),
  previous_position integer check (previous_position between 1 and 15),
  total_points integer not null default 0,
  wins integer not null default 0 check (wins >= 0),
  podiums integer not null default 0 check (podiums >= 0),
  updated_at timestamptz not null default now(),
  unique (league_id, season_id, team_id),
  unique (league_id, season_id, position)
);

create table public.vehicle_setups (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.drivers (id) on delete cascade,
  circuit_id uuid not null references public.circuits (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  game_version text check (game_version is null or char_length(game_version) <= 40),
  weather text check (weather is null or char_length(weather) <= 40),
  setup_data jsonb not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_setups_data_object check (jsonb_typeof(setup_data) = 'object')
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.workbook_migrations (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_id uuid not null references public.seasons (id) on delete restrict,
  source_file_name text not null check (char_length(source_file_name) between 1 and 160),
  source_file_hash text not null check (char_length(source_file_hash) between 32 and 128),
  status public.workbook_migration_status not null default 'draft',
  imported_by uuid references public.profiles (id) on delete set null,
  confirmed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (league_id, season_id, source_file_hash)
);

create or replace function public.current_profile_role()
returns public.profile_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_profile_role() in ('admin', 'super_admin'), false)
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_profile_role() = 'super_admin', false)
$$;

create or replace function public.owns_driver(target_driver_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.drivers
    where id = target_driver_id
      and profile_id = auth.uid()
  )
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'Racer'),
    'racer'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_leagues_updated_at
  before update on public.leagues
  for each row execute function public.set_updated_at();

create trigger set_vehicle_setups_updated_at
  before update on public.vehicle_setups
  for each row execute function public.set_updated_at();

create trigger set_driver_standings_updated_at
  before update on public.driver_standings
  for each row execute function public.set_updated_at();

create trigger set_team_standings_updated_at
  before update on public.team_standings
  for each row execute function public.set_updated_at();

create trigger set_driver_penalty_totals_updated_at
  before update on public.driver_penalty_totals
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.leagues enable row level security;
alter table public.points_systems enable row level security;
alter table public.official_team_templates enable row level security;
alter table public.teams enable row level security;
alter table public.drivers enable row level security;
alter table public.league_driver_entries enable row level security;
alter table public.driver_team_stints enable row level security;
alter table public.race_reserve_assignments enable row level security;
alter table public.circuits enable row level security;
alter table public.league_circuit_pools enable row level security;
alter table public.race_sessions enable row level security;
alter table public.wheel_spins enable row level security;
alter table public.qualifying_results enable row level security;
alter table public.race_results enable row level security;
alter table public.penalties enable row level security;
alter table public.championship_adjustments enable row level security;
alter table public.driver_penalty_totals enable row level security;
alter table public.driver_standings enable row level security;
alter table public.team_standings enable row level security;
alter table public.vehicle_setups enable row level security;
alter table public.audit_logs enable row level security;
alter table public.workbook_migrations enable row level security;

create policy profiles_self_read on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_admin_manage on public.profiles
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy public_read_seasons on public.seasons for select using (true);
create policy public_read_leagues on public.leagues for select using (true);
create policy public_read_points_systems on public.points_systems for select using (true);
create policy public_read_team_templates on public.official_team_templates for select using (true);
create policy public_read_teams on public.teams for select using (true);
create policy public_read_drivers on public.drivers for select using (true);
create policy public_read_driver_entries on public.league_driver_entries for select using (true);
create policy public_read_driver_team_stints on public.driver_team_stints for select using (true);
create policy public_read_reserve_assignments on public.race_reserve_assignments for select using (true);
create policy public_read_circuits on public.circuits for select using (true);
create policy public_read_circuit_pools on public.league_circuit_pools for select using (true);
create policy public_read_race_sessions on public.race_sessions for select using (true);
create policy public_read_wheel_spins on public.wheel_spins for select using (true);
create policy public_read_qualifying_results on public.qualifying_results for select using (true);
create policy public_read_race_results on public.race_results for select using (true);
create policy public_read_penalties on public.penalties for select using (true);
create policy public_read_championship_adjustments on public.championship_adjustments for select using (true);
create policy public_read_driver_penalty_totals on public.driver_penalty_totals for select using (true);
create policy public_read_driver_standings on public.driver_standings for select using (true);
create policy public_read_team_standings on public.team_standings for select using (true);

create policy admin_manage_seasons on public.seasons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_leagues on public.leagues for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_points_systems on public.points_systems for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_team_templates on public.official_team_templates for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy admin_manage_teams on public.teams for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_drivers on public.drivers for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_driver_entries on public.league_driver_entries for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_driver_team_stints on public.driver_team_stints for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_reserve_assignments on public.race_reserve_assignments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_circuits on public.circuits for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_circuit_pools on public.league_circuit_pools for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_race_sessions on public.race_sessions for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_wheel_spins on public.wheel_spins for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_qualifying_results on public.qualifying_results for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_race_results on public.race_results for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_penalties on public.penalties for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_championship_adjustments on public.championship_adjustments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_driver_penalty_totals on public.driver_penalty_totals for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_driver_standings on public.driver_standings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_team_standings on public.team_standings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_manage_workbook_migrations on public.workbook_migrations for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy vehicle_setups_public_or_owner_read on public.vehicle_setups
  for select to authenticated
  using (is_public or public.owns_driver(driver_id) or public.is_admin());

create policy vehicle_setups_owner_insert on public.vehicle_setups
  for insert to authenticated
  with check (public.owns_driver(driver_id));

create policy vehicle_setups_owner_update on public.vehicle_setups
  for update to authenticated
  using (public.owns_driver(driver_id))
  with check (public.owns_driver(driver_id));

create policy vehicle_setups_owner_delete on public.vehicle_setups
  for delete to authenticated
  using (public.owns_driver(driver_id));

create policy vehicle_setups_admin_manage on public.vehicle_setups
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated
  using (public.is_admin());

create policy audit_logs_admin_insert on public.audit_logs
  for insert to authenticated
  with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('league-assets', 'league-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('team-assets', 'team-assets', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy public_read_brand_assets on storage.objects
  for select using (bucket_id in ('league-assets', 'team-assets'));

create policy admin_write_brand_assets on storage.objects
  for all to authenticated
  using (bucket_id in ('league-assets', 'team-assets') and public.is_admin())
  with check (bucket_id in ('league-assets', 'team-assets') and public.is_admin());

insert into public.official_team_templates (name, slug, color_hex, sort_order)
values
  ('Red Bull Racing', 'red-bull-racing', '#3671C6', 1),
  ('Ferrari', 'ferrari', '#E8002D', 2),
  ('Mercedes', 'mercedes', '#00D2BE', 3),
  ('McLaren', 'mclaren', '#FF8000', 4),
  ('Alpine', 'alpine', '#0090FF', 5),
  ('Aston Martin', 'aston-martin', '#358C75', 6),
  ('Haas', 'haas', '#B6BABD', 7),
  ('Williams', 'williams', '#005AFF', 8),
  ('Racing Bulls', 'racing-bulls', '#6692FF', 9),
  ('Kick Sauber', 'kick-sauber', '#52E252', 10)
on conflict (slug) do update
set name = excluded.name,
    color_hex = excluded.color_hex,
    sort_order = excluded.sort_order;

insert into public.circuits (round_number, name, slug, country, venue, grand_prix_name, starts_on, ends_on)
values
  (1, 'Albert Park Circuit', 'albert-park', 'Australia', 'Melbourne', 'Australian Grand Prix', '2025-03-14', '2025-03-16'),
  (2, 'Shanghai International Circuit', 'shanghai', 'China', 'Shanghai', 'Chinese Grand Prix', '2025-03-21', '2025-03-23'),
  (3, 'Suzuka Circuit', 'suzuka', 'Japan', 'Suzuka', 'Japanese Grand Prix', '2025-04-04', '2025-04-06'),
  (4, 'Bahrain International Circuit', 'bahrain', 'Bahrain', 'Sakhir', 'Bahrain Grand Prix', '2025-04-11', '2025-04-13'),
  (5, 'Jeddah Corniche Circuit', 'jeddah', 'Saudi Arabia', 'Jeddah', 'Saudi Arabian Grand Prix', '2025-04-18', '2025-04-20'),
  (6, 'Miami International Autodrome', 'miami', 'USA', 'Miami', 'Miami Grand Prix', '2025-05-02', '2025-05-04'),
  (7, 'Autodromo Internazionale Enzo e Dino Ferrari', 'imola', 'Italy', 'Imola', 'Emilia-Romagna Grand Prix', '2025-05-16', '2025-05-18'),
  (8, 'Circuit de Monaco', 'monaco', 'Monaco', 'Monaco', 'Monaco Grand Prix', '2025-05-23', '2025-05-25'),
  (9, 'Circuit de Barcelona-Catalunya', 'barcelona-catalunya', 'Spain', 'Barcelona', 'Spanish Grand Prix', '2025-05-30', '2025-06-01'),
  (10, 'Circuit Gilles Villeneuve', 'circuit-gilles-villeneuve', 'Canada', 'Montreal', 'Canadian Grand Prix', '2025-06-13', '2025-06-15'),
  (11, 'Red Bull Ring', 'red-bull-ring', 'Austria', 'Spielberg', 'Austrian Grand Prix', '2025-06-27', '2025-06-29'),
  (12, 'Silverstone Circuit', 'silverstone', 'United Kingdom', 'Silverstone', 'British Grand Prix', '2025-07-04', '2025-07-06'),
  (13, 'Circuit de Spa-Francorchamps', 'spa-francorchamps', 'Belgium', 'Spa', 'Belgian Grand Prix', '2025-07-25', '2025-07-27'),
  (14, 'Hungaroring', 'hungaroring', 'Hungary', 'Budapest', 'Hungarian Grand Prix', '2025-08-01', '2025-08-03'),
  (15, 'Circuit Zandvoort', 'zandvoort', 'Netherlands', 'Zandvoort', 'Dutch Grand Prix', '2025-08-29', '2025-08-31'),
  (16, 'Autodromo Nazionale Monza', 'monza', 'Italy', 'Monza', 'Italian Grand Prix', '2025-09-05', '2025-09-07'),
  (17, 'Baku City Circuit', 'baku', 'Azerbaijan', 'Baku', 'Azerbaijan Grand Prix', '2025-09-19', '2025-09-21'),
  (18, 'Marina Bay Street Circuit', 'marina-bay', 'Singapore', 'Singapore', 'Singapore Grand Prix', '2025-10-03', '2025-10-05'),
  (19, 'Circuit of The Americas', 'circuit-of-the-americas', 'USA', 'Austin', 'United States Grand Prix', '2025-10-17', '2025-10-19'),
  (20, 'Autodromo Hermanos Rodriguez', 'autodromo-hermanos-rodriguez', 'Mexico', 'Mexico City', 'Mexico City Grand Prix', '2025-10-24', '2025-10-26'),
  (21, 'Interlagos', 'interlagos', 'Brazil', 'Sao Paulo', 'Sao Paulo Grand Prix', '2025-11-07', '2025-11-09'),
  (22, 'Las Vegas Strip Circuit', 'las-vegas-strip', 'USA', 'Las Vegas', 'Las Vegas Grand Prix', '2025-11-20', '2025-11-22'),
  (23, 'Lusail International Circuit', 'lusail', 'Qatar', 'Lusail', 'Qatar Grand Prix', '2025-11-28', '2025-11-30'),
  (24, 'Yas Marina Circuit', 'yas-marina', 'Abu Dhabi', 'Yas Marina', 'Abu Dhabi Grand Prix', '2025-12-05', '2025-12-07')
on conflict (slug) do update
set round_number = excluded.round_number,
    country = excluded.country,
    venue = excluded.venue,
    grand_prix_name = excluded.grand_prix_name,
    starts_on = excluded.starts_on,
    ends_on = excluded.ends_on;

create index seasons_current_idx on public.seasons (is_current) where is_current;
create index leagues_season_status_idx on public.leagues (season_id, status);
create index teams_league_idx on public.teams (league_id);
create index drivers_profile_idx on public.drivers (profile_id);
create index league_driver_entries_lookup_idx on public.league_driver_entries (league_id, season_id, driver_id);
create index driver_team_stints_entry_dates_idx on public.driver_team_stints (league_driver_entry_id, starts_on, ends_on);
create index race_sessions_public_idx on public.race_sessions (league_id, season_id, scheduled_at);
create index race_results_session_idx on public.race_results (race_session_id, finishing_position);
create index penalties_driver_idx on public.penalties (league_id, season_id, driver_id);
create index vehicle_setups_driver_circuit_idx on public.vehicle_setups (driver_id, circuit_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
