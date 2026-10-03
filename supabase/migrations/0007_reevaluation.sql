-- 0007: links between assessment versions for re-evaluation.
-- Run in the Supabase SQL editor after 0006.

alter table public.assessments
  add column if not exists superseded_by_id uuid references public.assessments (id) on delete set null;

create index if not exists assessments_superseded_by_idx
  on public.assessments (superseded_by_id);

comment on column public.assessments.supersedes_id is
  'The earlier assessment version this one re-evaluates, if any.';
comment on column public.assessments.superseded_by_id is
  'The later assessment version that replaced this one, if any.';

-- Moves live tracking items (actions, risk acceptances) from a mapping in a
-- superseded assessment to the matching mapping in its re-evaluation.
-- Runs with the caller's privileges, so row-level security still applies.
create or replace function public.move_mapping_dependents(
  p_from_mapping uuid,
  p_to_mapping uuid,
  p_to_assessment uuid
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  moved_actions integer;
  moved_acceptances integer;
begin
  update public.remediation_actions
     set impact_mapping_id = p_to_mapping,
         assessment_id = p_to_assessment
   where impact_mapping_id = p_from_mapping;
  get diagnostics moved_actions = row_count;

  update public.risk_acceptances
     set impact_mapping_id = p_to_mapping,
         assessment_id = p_to_assessment
   where impact_mapping_id = p_from_mapping;
  get diagnostics moved_acceptances = row_count;

  return jsonb_build_object('actions', moved_actions, 'acceptances', moved_acceptances);
end;
$$;
