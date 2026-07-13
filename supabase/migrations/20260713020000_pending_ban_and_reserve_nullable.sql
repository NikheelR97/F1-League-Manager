-- M8 — Ban Watch showed a threshold-crossed driver but had no action beyond
-- an alert; enforcement meant an admin hand-setting the driver's next race
-- Status to BAN and remembering to do it. Adds a one-click "Apply ban" flag
-- on the driver's season entry (same league+season granularity as the
-- ban-watch threshold itself). The next session's publish form reads this to
-- pre-select Status=BAN with a SUSPENDED badge; publish-service clears it
-- once a ban result is actually recorded for that driver.
alter table public.league_driver_entries
  add column pending_ban boolean not null default false;

-- M4 — the reserve tracker only ever recorded an assignment when the admin
-- named who the reserve covered for (original_driver_id was NOT NULL). A
-- reserve who raced for a non-home team with no "Covering For" set went
-- unrecorded even though they clearly weren't racing for their own team.
-- Dropping NOT NULL lets publish-service write a row with a null
-- original_driver_id for that case. Postgres treats each NULL as distinct
-- under the existing unique(race_session_id, original_driver_id) constraint,
-- so multiple such rows per session still don't collide.
alter table public.race_reserve_assignments
  alter column original_driver_id drop not null;
