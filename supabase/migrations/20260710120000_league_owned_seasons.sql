-- Season ownership flip: seasons belong to a league, not the other way
-- round. See dev docs/SEASON_FLIP_SPRINT_PLAN.md (locked decisions 1-3).
--
-- (a) Dependency check performed before writing this migration: grepped every
-- file in supabase/migrations/ for `leagues.season_id` and for `season_id`
-- inside any `create view`, `create function`, `create policy`, or generated
-- column. Result: nothing depends on `leagues.season_id` except the
-- same-table index `leagues_season_status_idx` (s1, on (season_id, status)),
-- which Postgres drops automatically when the column is dropped (table-owned
-- indexes are not external dependents and don't need CASCADE). The
-- `confirm_wheel_spin_session` function (s6) and the `penalties` column
-- grant (s4) reference child-table `season_id` columns (wheel_spins,
-- race_sessions, penalties) — those columns are untouched by this migration.
-- No view/function/policy needed dropping or recreating.

-- (b) Add the new ownership column, nullable until data is remapped.
alter table public.seasons
  add column league_id uuid references public.leagues (id) on delete cascade;

-- (c) Data remap. Seasons are currently global/shared across leagues; give
-- every league its own season row while preserving existing child data.
--
-- ponytail: this block only does real work against prod data. On a fresh
-- local db, migrations run before seed.sql, so public.seasons is empty here
-- and both loops below are no-ops (zero iterations).
create temp table season_remap (
  original_season_id uuid not null,
  league_id uuid not null,
  result_season_id uuid not null
);

do $$
declare
  s record;
  league_row record;
  new_id uuid;
  is_first boolean;
begin
  for s in select * from public.seasons order by id loop
    is_first := true;

    for league_row in
      select l.id, l.created_at
      from public.leagues l
      where l.id in (
        select id from public.leagues where season_id = s.id
        union
        select league_id from public.race_sessions where season_id = s.id
        union
        select league_id from public.league_driver_entries where season_id = s.id
        union
        select league_id from public.wheel_spins where season_id = s.id
        union
        select league_id from public.penalties where season_id = s.id
        union
        select league_id from public.championship_adjustments where season_id = s.id
        union
        select league_id from public.driver_penalty_totals where season_id = s.id
        union
        select league_id from public.driver_standings where season_id = s.id
        union
        select league_id from public.team_standings where season_id = s.id
        union
        select league_id from public.workbook_migrations where season_id = s.id
      )
      order by l.created_at, l.id
    loop
      if is_first then
        -- The first league in the ordered list keeps the original row.
        update public.seasons set league_id = league_row.id where id = s.id;
        insert into season_remap (original_season_id, league_id, result_season_id)
          values (s.id, league_row.id, s.id);
        is_first := false;
      else
        -- Every subsequent league gets its own clone of the season, and its
        -- child rows are remapped onto the clone.
        new_id := gen_random_uuid();
        insert into public.seasons (id, name, starts_on, ends_on, is_current, league_id)
          values (new_id, s.name, s.starts_on, s.ends_on, s.is_current, league_row.id);
        insert into season_remap (original_season_id, league_id, result_season_id)
          values (s.id, league_row.id, new_id);

        update public.race_sessions set season_id = new_id where season_id = s.id and league_id = league_row.id;
        update public.league_driver_entries set season_id = new_id where season_id = s.id and league_id = league_row.id;
        update public.wheel_spins set season_id = new_id where season_id = s.id and league_id = league_row.id;
        update public.penalties set season_id = new_id where season_id = s.id and league_id = league_row.id;
        update public.championship_adjustments set season_id = new_id where season_id = s.id and league_id = league_row.id;
        update public.driver_penalty_totals set season_id = new_id where season_id = s.id and league_id = league_row.id;
        update public.driver_standings set season_id = new_id where season_id = s.id and league_id = league_row.id;
        update public.team_standings set season_id = new_id where season_id = s.id and league_id = league_row.id;
        update public.workbook_migrations set season_id = new_id where season_id = s.id and league_id = league_row.id;
      end if;
    end loop;
  end loop;
end;
$$;

-- Normalize is_current per league: exactly one current season per league,
-- matching whichever season used to be that league's leagues.season_id
-- (falling back to the newest by starts_on if no match is found).
do $$
declare
  lg record;
  target_season_id uuid;
begin
  for lg in select id, season_id from public.leagues loop
    select result_season_id into target_season_id
    from season_remap
    where original_season_id = lg.season_id and league_id = lg.id;

    if target_season_id is null then
      select id into target_season_id
      from public.seasons
      where league_id = lg.id
      order by starts_on desc
      limit 1;
    end if;

    if target_season_id is not null then
      update public.seasons set is_current = false where league_id = lg.id and id <> target_season_id;
      update public.seasons set is_current = true where id = target_season_id;
    end if;
  end loop;
end;
$$;

drop table season_remap;

-- (d) Any season no league claimed (shouldn't happen given every league had
-- a not-null season_id, but guards against orphaned rows).
delete from public.seasons where league_id is null;

-- (e) Ownership is now mandatory.
alter table public.seasons alter column league_id set not null;

-- (f) Constraints and indexes on seasons.
alter table public.seasons
  add constraint seasons_league_name_unique unique (league_id, name);

alter table public.seasons
  add constraint seasons_id_league_unique unique (id, league_id);

create unique index seasons_one_current_per_league
  on public.seasons (league_id) where is_current;

-- (g) Composite FKs on every child table that carries both league_id and
-- season_id, so a row can never reference a season owned by another league.
alter table public.race_sessions
  add constraint race_sessions_season_league_fk
  foreign key (season_id, league_id) references public.seasons (id, league_id) on delete restrict;

alter table public.league_driver_entries
  add constraint league_driver_entries_season_league_fk
  foreign key (season_id, league_id) references public.seasons (id, league_id) on delete restrict;

alter table public.wheel_spins
  add constraint wheel_spins_season_league_fk
  foreign key (season_id, league_id) references public.seasons (id, league_id) on delete restrict;

alter table public.penalties
  add constraint penalties_season_league_fk
  foreign key (season_id, league_id) references public.seasons (id, league_id) on delete restrict;

alter table public.championship_adjustments
  add constraint championship_adjustments_season_league_fk
  foreign key (season_id, league_id) references public.seasons (id, league_id) on delete restrict;

alter table public.driver_penalty_totals
  add constraint driver_penalty_totals_season_league_fk
  foreign key (season_id, league_id) references public.seasons (id, league_id) on delete restrict;

alter table public.driver_standings
  add constraint driver_standings_season_league_fk
  foreign key (season_id, league_id) references public.seasons (id, league_id) on delete restrict;

alter table public.team_standings
  add constraint team_standings_season_league_fk
  foreign key (season_id, league_id) references public.seasons (id, league_id) on delete restrict;

alter table public.workbook_migrations
  add constraint workbook_migrations_season_league_fk
  foreign key (season_id, league_id) references public.seasons (id, league_id) on delete restrict;

-- (g.2) Drop the now-redundant single-column season_id FKs. The composite FK
-- above fully subsumes them (league_id is NOT NULL on every one of these
-- tables, so (season_id, league_id) already guarantees season_id is valid AND
-- belongs to the row's league). Keeping both would leave TWO race_sessions→
-- seasons relationships, which makes every PostgREST `seasons(...)` embed
-- ambiguous (PGRST201) — e.g. resolve-league-seasons.ts silently returns no
-- rows. Explicit season_id indexes (if any) are separate objects and survive.
alter table public.race_sessions drop constraint race_sessions_season_id_fkey;
alter table public.league_driver_entries drop constraint league_driver_entries_season_id_fkey;
alter table public.wheel_spins drop constraint wheel_spins_season_id_fkey;
alter table public.penalties drop constraint penalties_season_id_fkey;
alter table public.championship_adjustments drop constraint championship_adjustments_season_id_fkey;
alter table public.driver_penalty_totals drop constraint driver_penalty_totals_season_id_fkey;
alter table public.driver_standings drop constraint driver_standings_season_id_fkey;
alter table public.team_standings drop constraint team_standings_season_id_fkey;
alter table public.workbook_migrations drop constraint workbook_migrations_season_id_fkey;

-- (h) leagues.season_id is no longer needed: a league's current season is
-- derived (seasons where league_id = ? and is_current). No view, function,
-- or policy depends on this column (see the dependency check above), so it
-- can be dropped directly; Postgres drops leagues_season_status_idx (s1)
-- along with it automatically.
alter table public.leagues drop column season_id;

-- (i) RLS: public_read_seasons and admin_manage_seasons (s1) are table-level
-- policies (`using (true)` / `using (public.is_admin())`), unaffected by
-- adding a column. Nothing to recreate.
