-- S9: Spreadsheet import

-- Unique constraint so the import service can upsert sessions by code within a
-- league+season (prevents duplicate sessions on re-upload before confirmation).
alter table public.race_sessions
  add constraint race_sessions_league_season_code_unique
  unique (league_id, season_id, session_code);

-- Fast lookup: "is there already a confirmed migration for this league+season?"
-- Called on every upload attempt to enforce the post-confirmation lock.
create index if not exists workbook_migrations_league_season_status_idx
  on public.workbook_migrations (league_id, season_id, status);
