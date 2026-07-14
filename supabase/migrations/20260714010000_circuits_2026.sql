-- 2026 F1 calendar for the circuit library (wheel pool + session circuit picker):
--   * Imola drops off the calendar.
--   * Madrid (Madring) joins as round 16.
--   * All rounds/dates shift to the 2026 season.
-- Idempotent. Existing circuits are matched by slug; only round_number/dates
-- change for them, so any race_sessions already pointing at a circuit stay valid.

-- Release the unique round_number constraint before renumbering.
update public.circuits set round_number = null;

-- Imola isn't on the 2026 calendar. Remove it only if no session references it
-- (preserve historical results); otherwise it stays as an unnumbered circuit.
delete from public.circuits c
 where c.slug = 'imola'
   and not exists (select 1 from public.race_sessions rs where rs.circuit_id = c.id);

insert into public.circuits (round_number, name, slug, country, venue, grand_prix_name, starts_on, ends_on)
values
  (1,  'Albert Park Circuit', 'albert-park', 'Australia', 'Melbourne', 'Australian Grand Prix', '2026-03-06', '2026-03-08'),
  (2,  'Shanghai International Circuit', 'shanghai', 'China', 'Shanghai', 'Chinese Grand Prix', '2026-03-13', '2026-03-15'),
  (3,  'Suzuka Circuit', 'suzuka', 'Japan', 'Suzuka', 'Japanese Grand Prix', '2026-03-27', '2026-03-29'),
  (4,  'Bahrain International Circuit', 'bahrain', 'Bahrain', 'Sakhir', 'Bahrain Grand Prix', '2026-04-10', '2026-04-12'),
  (5,  'Jeddah Corniche Circuit', 'jeddah', 'Saudi Arabia', 'Jeddah', 'Saudi Arabian Grand Prix', '2026-04-17', '2026-04-19'),
  (6,  'Miami International Autodrome', 'miami', 'USA', 'Miami', 'Miami Grand Prix', '2026-05-01', '2026-05-03'),
  (7,  'Circuit Gilles Villeneuve', 'circuit-gilles-villeneuve', 'Canada', 'Montreal', 'Canadian Grand Prix', '2026-05-22', '2026-05-24'),
  (8,  'Circuit de Monaco', 'monaco', 'Monaco', 'Monaco', 'Monaco Grand Prix', '2026-06-05', '2026-06-07'),
  (9,  'Circuit de Barcelona-Catalunya', 'barcelona-catalunya', 'Spain', 'Barcelona', 'Spanish Grand Prix', '2026-06-12', '2026-06-14'),
  (10, 'Red Bull Ring', 'red-bull-ring', 'Austria', 'Spielberg', 'Austrian Grand Prix', '2026-06-26', '2026-06-28'),
  (11, 'Silverstone Circuit', 'silverstone', 'United Kingdom', 'Silverstone', 'British Grand Prix', '2026-07-03', '2026-07-05'),
  (12, 'Circuit de Spa-Francorchamps', 'spa-francorchamps', 'Belgium', 'Spa', 'Belgian Grand Prix', '2026-07-17', '2026-07-19'),
  (13, 'Hungaroring', 'hungaroring', 'Hungary', 'Budapest', 'Hungarian Grand Prix', '2026-07-24', '2026-07-26'),
  (14, 'Circuit Zandvoort', 'zandvoort', 'Netherlands', 'Zandvoort', 'Dutch Grand Prix', '2026-08-21', '2026-08-23'),
  (15, 'Autodromo Nazionale Monza', 'monza', 'Italy', 'Monza', 'Italian Grand Prix', '2026-09-04', '2026-09-06'),
  (16, 'Madring', 'madring', 'Spain', 'Madrid', 'Madrid Grand Prix', '2026-09-11', '2026-09-13'),
  (17, 'Baku City Circuit', 'baku', 'Azerbaijan', 'Baku', 'Azerbaijan Grand Prix', '2026-09-25', '2026-09-27'),
  (18, 'Marina Bay Street Circuit', 'marina-bay', 'Singapore', 'Singapore', 'Singapore Grand Prix', '2026-10-09', '2026-10-11'),
  (19, 'Circuit of The Americas', 'circuit-of-the-americas', 'USA', 'Austin', 'United States Grand Prix', '2026-10-23', '2026-10-25'),
  (20, 'Autodromo Hermanos Rodriguez', 'autodromo-hermanos-rodriguez', 'Mexico', 'Mexico City', 'Mexico City Grand Prix', '2026-10-30', '2026-11-01'),
  (21, 'Interlagos', 'interlagos', 'Brazil', 'Sao Paulo', 'Sao Paulo Grand Prix', '2026-11-06', '2026-11-08'),
  (22, 'Las Vegas Strip Circuit', 'las-vegas-strip', 'USA', 'Las Vegas', 'Las Vegas Grand Prix', '2026-11-19', '2026-11-21'),
  (23, 'Lusail International Circuit', 'lusail', 'Qatar', 'Lusail', 'Qatar Grand Prix', '2026-11-27', '2026-11-29'),
  (24, 'Yas Marina Circuit', 'yas-marina', 'UAE', 'Yas Marina', 'Abu Dhabi Grand Prix', '2026-12-04', '2026-12-06')
on conflict (slug) do update
set round_number = excluded.round_number,
    name = excluded.name,
    country = excluded.country,
    venue = excluded.venue,
    grand_prix_name = excluded.grand_prix_name,
    starts_on = excluded.starts_on,
    ends_on = excluded.ends_on;
