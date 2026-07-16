-- 2026 F1 grid update to the official team templates that seed the
-- "add official teams" action:
--   * Sauber becomes Audi (Audi takes over the Hinwil squad for 2026).
--   * Cadillac (GM) joins as the 11th team.
-- Idempotent (safe to re-run). Teams already created from the old templates are
-- untouched — these rows are only the source list, and team colours are
-- admin-editable afterwards, so the hexes below are best-known placeholders.
update public.official_team_templates
  set name = 'Audi', slug = 'audi', color_hex = '#BB0A30'
  where slug = 'kick-sauber';

insert into public.official_team_templates (name, slug, color_hex, sort_order)
values ('Cadillac', 'cadillac', '#0A2240', 11)
on conflict (slug) do nothing;
