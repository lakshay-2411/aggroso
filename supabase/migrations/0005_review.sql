-- 0005: reviewer workflow columns on impact mappings.
-- Run in the Supabase SQL editor after 0004.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'mapping_source') then
    create type public.mapping_source as enum ('agent', 'reviewer');
  end if;
end
$$;

alter table public.impact_mappings
  add column if not exists source public.mapping_source not null default 'agent',
  add column if not exists no_action_required boolean not null default false;

comment on column public.impact_mappings.source is
  'agent: proposed by the AI pipeline; reviewer: added manually during review.';
comment on column public.impact_mappings.no_action_required is
  'Set by a reviewer when the impact is real but already satisfied, so the mapping counts as resolved.';
