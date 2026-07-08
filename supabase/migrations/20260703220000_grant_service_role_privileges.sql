-- No prior migration ever granted table privileges explicitly; the app has
-- always relied on Supabase's ambient default grants for service_role/anon/
-- authenticated. That worked on long-lived local instances but not on a
-- genuinely fresh database (e.g. a CI-provisioned Supabase stack), where
-- service_role got "permission denied for table leagues". service_role has
-- BYPASSRLS at the role level (unrelated to this), but Postgres still checks
-- table-level GRANTs before RLS is ever evaluated.
--
-- Idempotent and safe to re-run: GRANT is not additive-only in a harmful
-- way, and ALTER DEFAULT PRIVILEGES only affects objects created after this
-- statement runs (i.e. every future migration in this project).

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

grant select on all tables in schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant all on functions to service_role;

alter default privileges in schema public
  grant select on tables to anon, authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
