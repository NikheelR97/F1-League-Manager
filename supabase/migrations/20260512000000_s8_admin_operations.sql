-- S8: Admin operations — seasons archiving, audit log filtering indexes

-- Add is_archived to seasons so old seasons can be hidden from active selectors
-- while remaining queryable for historical results.
alter table public.seasons
  add column is_archived boolean not null default false;

-- Audit logs are append-only by design: the existing RLS only allows
-- admin insert and admin read — no update or delete policies exist.
-- Add indexes to support the audit log viewer filter queries.
create index audit_logs_actor_idx   on public.audit_logs (actor_id);
create index audit_logs_action_idx  on public.audit_logs (action);
create index audit_logs_entity_idx  on public.audit_logs (entity_type, entity_id);
