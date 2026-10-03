-- 0006: remediation actions and formal risk acceptances.
-- Run in the Supabase SQL editor after 0005.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'action_status') then
    create type public.action_status as enum ('open', 'in_progress', 'done', 'cancelled');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Remediation actions. Created from an accepted impact mapping, assigned to
-- an owner, and tracked to completion. Never deleted; cancel instead.
-- ---------------------------------------------------------------------------
create table if not exists public.remediation_actions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  impact_mapping_id uuid not null references public.impact_mappings (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete restrict,
  title text not null,
  description text,
  owner_id uuid references public.profiles (id) on delete set null,
  owner_name text,
  status public.action_status not null default 'open',
  due_date date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists remediation_actions_mapping_idx
  on public.remediation_actions (impact_mapping_id);
create index if not exists remediation_actions_assessment_idx
  on public.remediation_actions (assessment_id, status);
create index if not exists remediation_actions_owner_idx
  on public.remediation_actions (owner_id, status);

drop trigger if exists remediation_actions_set_updated_at on public.remediation_actions;
create trigger remediation_actions_set_updated_at
  before update on public.remediation_actions
  for each row execute function public.set_updated_at();

alter table public.remediation_actions enable row level security;

drop policy if exists "actions readable by authenticated" on public.remediation_actions;
create policy "actions readable by authenticated"
  on public.remediation_actions for select to authenticated using (true);

drop policy if exists "actions insertable by authenticated" on public.remediation_actions;
create policy "actions insertable by authenticated"
  on public.remediation_actions for insert to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "actions updatable by authenticated" on public.remediation_actions;
create policy "actions updatable by authenticated"
  on public.remediation_actions for update to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Risk acceptances. A formal decision not to remediate an accepted impact,
-- with a reason and a date by which it must be reviewed again. Revoked, not
-- deleted, so the history is preserved.
-- ---------------------------------------------------------------------------
create table if not exists public.risk_acceptances (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  impact_mapping_id uuid not null references public.impact_mappings (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete restrict,
  reason text not null,
  review_date date not null,
  accepted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id) on delete set null,
  revoke_reason text
);

create index if not exists risk_acceptances_mapping_idx
  on public.risk_acceptances (impact_mapping_id, revoked_at);

-- Only one active acceptance per mapping.
create unique index if not exists risk_acceptances_one_active_per_mapping
  on public.risk_acceptances (impact_mapping_id)
  where revoked_at is null;

alter table public.risk_acceptances enable row level security;

drop policy if exists "risk acceptances readable by authenticated" on public.risk_acceptances;
create policy "risk acceptances readable by authenticated"
  on public.risk_acceptances for select to authenticated using (true);

drop policy if exists "risk acceptances insertable by authenticated" on public.risk_acceptances;
create policy "risk acceptances insertable by authenticated"
  on public.risk_acceptances for insert to authenticated
  with check (auth.uid() = accepted_by);

drop policy if exists "risk acceptances updatable by authenticated" on public.risk_acceptances;
create policy "risk acceptances updatable by authenticated"
  on public.risk_acceptances for update to authenticated using (true) with check (true);
