-- Dev seed: two active leagues matching the hardcoded home-page cards.
-- Slugs "informal" and "standard" are required by league-data.ts.
-- Run after `supabase db reset` or `supabase migration up`.

-- ============================================================
-- Season
-- ============================================================
insert into public.seasons (id, name, starts_on, ends_on, is_current) values
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2025 Season', '2025-03-01', '2025-12-31', true);

-- ============================================================
-- Leagues
-- ============================================================
insert into public.leagues
  (id, name, slug, format, status, season_id, fastest_lap_enabled, pole_position_enabled, constructor_championship_enabled, penalty_threshold)
values
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Informal League', 'informal', 'informal', 'active',
   'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', true, false, false, 12),
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Standard League', 'standard', 'standard', 'active',
   'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', true, false, true, 12);

-- ============================================================
-- Points systems
-- ============================================================
insert into public.points_systems
  (id, league_id, name, points_by_position, fastest_lap_points, pole_position_points, max_positions)
values
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'Standard F1 Points',
   '{"1":25,"2":18,"3":15,"4":12,"5":10,"6":8,"7":6,"8":4,"9":2,"10":1}',
   1, 0, 10),
  ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
   'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
   'Standard F1 Points',
   '{"1":25,"2":18,"3":15,"4":12,"5":10,"6":8,"7":6,"8":4,"9":2,"10":1}',
   1, 0, 10);

-- ============================================================
-- Teams — Informal League (5 teams, 2 drivers each)
-- ============================================================
insert into public.teams (id, league_id, name, slug, kind, color_hex) values
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Red Racing',    'red-racing',    'custom', '#E8002D'),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Blue Speed',    'blue-speed',    'custom', '#0063CB'),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Green Force',   'green-force',   'custom', '#00A550'),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Orange Storm',  'orange-storm',  'custom', '#FF8000'),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Silver Arrow',  'silver-arrow',  'custom', '#C0C0C0');

-- ============================================================
-- Teams — Standard League (5 teams, 2 drivers each)
-- ============================================================
insert into public.teams (id, league_id, name, slug, kind, color_hex) values
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Alpine Ace',     'alpine-ace',     'custom', '#FF87BC'),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Grid Warrior',   'grid-warrior',   'custom', '#6B2FFA'),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a23', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Apex Chasers',   'apex-chasers',   'custom', '#1E41FF'),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Pit Stop Kings', 'pit-stop-kings', 'custom', '#3671C6'),
  ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a25', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Tarmac Beasts',  'tarmac-beasts',  'custom', '#52E252');

-- ============================================================
-- Drivers (global pool — no profile_id so they're "bot" drivers)
-- ============================================================
insert into public.drivers (id, display_name, racing_number, country, is_active) values
  -- Informal League
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Alessandro Ferrari',   7,  'Italy',          true),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Marco Rossi',         44,  'Italy',          true),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'Carlos Martinez',     14,  'Spain',          true),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'Pierre Dupont',       55,  'France',         true),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'Hans Mueller',        63,  'Germany',        true),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'James Wilson',         4,  'United Kingdom', true),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'Luca Brambilla',      81,  'Italy',          true),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', 'Sofia Andersen',      22,  'Denmark',        true),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', 'Kenji Tanaka',        11,  'Japan',          true),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'Emma Clarke',         16,  'United Kingdom', true),
  -- Standard League
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'Viktor Petrov',       99,  'Russia',         true),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'Amir Hassan',         10,  'UAE',            true),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a23', 'Lucas Santos',        20,  'Brazil',         true),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', 'Ethan Brooks',        33,  'USA',            true),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a25', 'Nadia Laurent',        2,  'France',         true),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a26', 'Ji-ho Choi',           6,  'South Korea',    true),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a27', 'Oliver Schmidt',      77,  'Germany',        true),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a28', 'Isabella Costa',       3,  'Brazil',         true),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a29', 'Ryan McAllister',     18,  'Australia',      true),
  ('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a30', 'Elena Volkova',       27,  'Russia',         true);

-- ============================================================
-- League driver entries
-- ============================================================
-- Informal League
insert into public.league_driver_entries (id, league_id, season_id, driver_id, is_reserve, joined_on) values
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', false, '2025-03-01'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', false, '2025-03-01'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', false, '2025-03-01'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', false, '2025-03-01'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', false, '2025-03-01'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', false, '2025-03-01'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', false, '2025-03-01'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', false, '2025-03-01'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', false, '2025-03-01'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', false, '2025-03-01');

-- Standard League
insert into public.league_driver_entries (id, league_id, season_id, driver_id, is_reserve, joined_on) values
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', false, '2025-03-01'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', false, '2025-03-01'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a23', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a23', false, '2025-03-01'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', false, '2025-03-01'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a25', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a25', false, '2025-03-01'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a26', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a26', false, '2025-03-01'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a27', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a27', false, '2025-03-01'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a28', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a28', false, '2025-03-01'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a29', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a29', false, '2025-03-01'),
  ('f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a30', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a30', false, '2025-03-01');

-- ============================================================
-- Driver team stints (2 drivers per team, starts 2025-03-01)
-- ============================================================
-- Informal League: teams d11–d15, entries f11–f20
insert into public.driver_team_stints (id, league_driver_entry_id, team_id, starts_on) values
  -- Red Racing: Alessandro Ferrari + Marco Rossi
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2025-03-01'),
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '2025-03-01'),
  -- Blue Speed: Carlos Martinez + Pierre Dupont
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', '2025-03-01'),
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', '2025-03-01'),
  -- Green Force: Hans Mueller + James Wilson
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', '2025-03-01'),
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', '2025-03-01'),
  -- Orange Storm: Luca Brambilla + Sofia Andersen
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', '2025-03-01'),
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', '2025-03-01'),
  -- Silver Arrow: Kenji Tanaka + Emma Clarke
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', '2025-03-01'),
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', '2025-03-01');

-- Standard League: teams d21–d25, entries f21–f30
insert into public.driver_team_stints (id, league_driver_entry_id, team_id, starts_on) values
  -- Alpine Ace: Viktor Petrov + Amir Hassan
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', '2025-03-01'),
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', '2025-03-01'),
  -- Grid Warrior: Lucas Santos + Ethan Brooks
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a23', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a23', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', '2025-03-01'),
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', '2025-03-01'),
  -- Apex Chasers: Nadia Laurent + Ji-ho Choi
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a25', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a25', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a23', '2025-03-01'),
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a26', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a26', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a23', '2025-03-01'),
  -- Pit Stop Kings: Oliver Schmidt + Isabella Costa
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a27', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a27', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', '2025-03-01'),
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a28', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a28', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', '2025-03-01'),
  -- Tarmac Beasts: Ryan McAllister + Elena Volkova
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a29', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a29', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a25', '2025-03-01'),
  ('05eebc99-9c0b-4ef8-bb6d-6bb9bd380a30', 'f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a30', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a25', '2025-03-01');

-- ============================================================
-- Race sessions
-- Circuit IDs are dynamic (gen_random_uuid() in S1 migration),
-- so we look them up by slug via scalar subqueries.
-- ============================================================

-- Informal League: 1 completed (Bahrain) + 1 scheduled (Australia)
-- race_length_percent = 25 per F1_INFORMAL_RACE_PCT
insert into public.race_sessions
  (id, league_id, season_id, circuit_id, points_system_id, name, session_code, race_number, race_length_percent, scheduled_at, status, published_at)
values
  ('09eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   (select id from public.circuits where slug = 'bahrain'),
   'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'Round 1 — Bahrain', 'INFRM1', 1, 25,
   '2025-04-13 18:00:00+00', 'completed', '2025-04-13 21:00:00+00'),
  ('09eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
   'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   (select id from public.circuits where slug = 'albert-park'),
   'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'Round 2 — Australia', 'INFRM2', 1, 25,
   '2026-06-15 06:00:00+00', 'scheduled', null);

-- Standard League: 1 completed (Japan) + 1 scheduled (China)
-- race_length_percent = 50 per F1_STANDARD_RACE_PCT
insert into public.race_sessions
  (id, league_id, season_id, circuit_id, points_system_id, name, session_code, race_number, race_length_percent, scheduled_at, status, published_at)
values
  ('09eebc99-9c0b-4ef8-bb6d-6bb9bd380a21',
   'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
   'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   (select id from public.circuits where slug = 'suzuka'),
   'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
   'Round 1 — Japan', 'STDRD1', 1, 50,
   '2025-04-06 05:00:00+00', 'completed', '2025-04-06 08:00:00+00'),
  ('09eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
   'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
   'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   (select id from public.circuits where slug = 'shanghai'),
   'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
   'Round 2 — China', 'STDRD2', 1, 50,
   '2026-06-22 07:00:00+00', 'scheduled', null);

-- ============================================================
-- Driver standings (precomputed snapshots)
-- Informal League — top 5 drivers with team_id
-- ============================================================
insert into public.driver_standings
  (league_id, season_id, driver_id, team_id, position, previous_position, total_points, wins, podiums, fastest_laps)
values
  -- 1st: Alessandro Ferrari (Red Racing, 25 pts + FL)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   1, null, 26, 1, 1, 1),
  -- 2nd: Carlos Martinez (Blue Speed, 18 pts)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
   2, null, 18, 0, 1, 0),
  -- 3rd: Hans Mueller (Green Force, 15 pts)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
   3, null, 15, 0, 1, 0),
  -- 4th: Luca Brambilla (Orange Storm, 12 pts)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a17', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
   4, null, 12, 0, 0, 0),
  -- 5th: Kenji Tanaka (Silver Arrow, 10 pts)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a19', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15',
   5, null, 10, 0, 0, 0),
  -- 6th: Marco Rossi (Red Racing, 8 pts)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   6, null, 8, 0, 0, 0),
  -- 7th: Pierre Dupont (Blue Speed, 6 pts)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
   7, null, 6, 0, 0, 0),
  -- 8th: James Wilson (Green Force, 4 pts)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a16', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
   8, null, 4, 0, 0, 0),
  -- 9th: Sofia Andersen (Orange Storm, 2 pts)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
   9, null, 2, 0, 0, 0),
  -- 10th: Emma Clarke (Silver Arrow, 1 pt)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a20', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15',
   10, null, 1, 0, 0, 0);

-- Standard League — top 5 drivers with team_id
insert into public.driver_standings
  (league_id, season_id, driver_id, team_id, position, previous_position, total_points, wins, podiums, fastest_laps)
values
  -- 1st: Viktor Petrov (Alpine Ace, 25 pts + FL)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21',
   1, null, 26, 1, 1, 1),
  -- 2nd: Lucas Santos (Grid Warrior, 18 pts)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a23', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
   2, null, 18, 0, 1, 0),
  -- 3rd: Nadia Laurent (Apex Chasers, 15 pts)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a25', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a23',
   3, null, 15, 0, 1, 0),
  -- 4th: Oliver Schmidt (Pit Stop Kings, 12 pts)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a27', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a24',
   4, null, 12, 0, 0, 0),
  -- 5th: Ryan McAllister (Tarmac Beasts, 10 pts)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a29', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a25',
   5, null, 10, 0, 0, 0),
  -- 6th: Amir Hassan (Alpine Ace, 8 pts)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21',
   6, null, 8, 0, 0, 0),
  -- 7th: Ethan Brooks (Grid Warrior, 6 pts)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
   7, null, 6, 0, 0, 0),
  -- 8th: Ji-ho Choi (Apex Chasers, 4 pts)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a26', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a23',
   8, null, 4, 0, 0, 0),
  -- 9th: Isabella Costa (Pit Stop Kings, 2 pts)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a28', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a24',
   9, null, 2, 0, 0, 0),
  -- 10th: Elena Volkova (Tarmac Beasts, 1 pt)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a30', 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a25',
   10, null, 1, 0, 0, 0);

-- ============================================================
-- Team standings (Informal League constructor championship disabled,
-- but we seed Standard League which has it enabled)
-- ============================================================
insert into public.team_standings
  (league_id, season_id, team_id, position, previous_position, total_points, wins, podiums)
values
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a21', 1, null, 34, 1, 1),  -- Alpine Ace (26 + 8)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', 2, null, 24, 0, 1),  -- Grid Warrior (18 + 6)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a23', 3, null, 19, 0, 1),  -- Apex Chasers (15 + 4)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a24', 4, null, 14, 0, 0),  -- Pit Stop Kings (12 + 2)
  ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
   'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a25', 5, null, 11, 0, 0);  -- Tarmac Beasts (10 + 1)
