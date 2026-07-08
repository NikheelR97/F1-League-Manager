-- driver_standings was missing team_id, which the league hub joins for displaying
-- team colour next to each driver in the standings preview.
alter table public.driver_standings
  add column team_id uuid references public.teams (id) on delete set null;

create index driver_standings_team_idx on public.driver_standings (team_id);
