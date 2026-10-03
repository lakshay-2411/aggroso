-- 0004: assessments, requirement changes, impact mappings, context questions.
-- Run in the Supabase SQL editor after 0003.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'assessment_status') then
    create type public.assessment_status as enum (
      'draft', 'analyzing', 'in_review', 'completed', 'failed'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'change_type') then
    create type public.change_type as enum ('added', 'modified', 'removed');
  end if;
  if not exists (select 1 from pg_type where typname = 'impact_level') then
    create type public.impact_level as enum ('confirmed', 'possible');
  end if;
  if not exists (select 1 from pg_type where typname = 'review_status') then
    create type public.review_status as enum (
      'pending', 'accepted', 'rejected', 'corrected'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Assessments: one run of "how does moving from version A to version B of a
-- policy affect the control register". Each run is its own versioned record.
-- control_snapshot stores {control_id: revision} at analysis time so later
-- control changes can be detected deterministically.
-- ---------------------------------------------------------------------------
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies (id) on delete restrict,
  from_version_id uuid not null references public.policy_versions (id) on delete restrict,
  to_version_id uuid not null references public.policy_versions (id) on delete restrict,
  assessment_version integer not null default 1,
  supersedes_id uuid references public.assessments (id) on delete set null,
  status public.assessment_status not null default 'draft',
  is_stale boolean not null default false,
  stale_reasons jsonb not null default '[]'::jsonb,
  control_snapshot jsonb not null default '{}'::jsonb,
  ai_model text,
  ai_summary text,
  ai_error text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  analyzed_at timestamptz,
  completed_at timestamptz,
  constraint assessments_distinct_versions check (from_version_id <> to_version_id)
);

create index if not exists assessments_policy_idx
  on public.assessments (policy_id, created_at desc);

drop trigger if exists assessments_set_updated_at on public.assessments;
create trigger assessments_set_updated_at
  before update on public.assessments
  for each row execute function public.set_updated_at();

alter table public.assessments enable row level security;

drop policy if exists "assessments readable by authenticated" on public.assessments;
create policy "assessments readable by authenticated"
  on public.assessments for select to authenticated using (true);

drop policy if exists "assessments insertable by authenticated" on public.assessments;
create policy "assessments insertable by authenticated"
  on public.assessments for insert to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "assessments updatable by authenticated" on public.assessments;
create policy "assessments updatable by authenticated"
  on public.assessments for update to authenticated
  using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Requirement changes extracted between the two versions, with citations.
-- citation_verified is set by the application after checking that the quoted
-- text really appears in the stored version content.
-- ---------------------------------------------------------------------------
create table if not exists public.requirement_changes (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  position integer not null,
  change_type public.change_type not null,
  title text not null,
  summary text not null,
  old_section_ref text,
  old_text text,
  new_section_ref text,
  new_text text,
  rationale text,
  citation_verified boolean not null default false,
  created_at timestamptz not null default now(),
  unique (assessment_id, position)
);

alter table public.requirement_changes enable row level security;

drop policy if exists "requirement changes readable by authenticated" on public.requirement_changes;
create policy "requirement changes readable by authenticated"
  on public.requirement_changes for select to authenticated using (true);

drop policy if exists "requirement changes insertable by authenticated" on public.requirement_changes;
create policy "requirement changes insertable by authenticated"
  on public.requirement_changes for insert to authenticated with check (true);

drop policy if exists "requirement changes deletable by authenticated" on public.requirement_changes;
create policy "requirement changes deletable by authenticated"
  on public.requirement_changes for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Impact mappings: one row per (change, control) the agent linked.
-- The ai_* columns are never edited; reviewer decisions live alongside them.
-- ---------------------------------------------------------------------------
create table if not exists public.impact_mappings (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  requirement_change_id uuid not null references public.requirement_changes (id) on delete cascade,
  control_id uuid not null references public.controls (id) on delete restrict,
  ai_impact_level public.impact_level not null,
  ai_rationale text not null,
  evidence_outdated boolean not null default false,
  evidence_rationale text,
  suggested_remediation text,
  review_status public.review_status not null default 'pending',
  final_impact_level public.impact_level,
  reviewer_id uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, requirement_change_id, control_id)
);

create index if not exists impact_mappings_assessment_idx
  on public.impact_mappings (assessment_id, control_id);

drop trigger if exists impact_mappings_set_updated_at on public.impact_mappings;
create trigger impact_mappings_set_updated_at
  before update on public.impact_mappings
  for each row execute function public.set_updated_at();

alter table public.impact_mappings enable row level security;

drop policy if exists "impact mappings readable by authenticated" on public.impact_mappings;
create policy "impact mappings readable by authenticated"
  on public.impact_mappings for select to authenticated using (true);

drop policy if exists "impact mappings insertable by authenticated" on public.impact_mappings;
create policy "impact mappings insertable by authenticated"
  on public.impact_mappings for insert to authenticated with check (true);

drop policy if exists "impact mappings updatable by authenticated" on public.impact_mappings;
create policy "impact mappings updatable by authenticated"
  on public.impact_mappings for update to authenticated using (true) with check (true);

drop policy if exists "impact mappings deletable by authenticated" on public.impact_mappings;
create policy "impact mappings deletable by authenticated"
  on public.impact_mappings for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Context questions: things the agent could not decide without more
-- information. Reviewers answer them; answers feed re-evaluation.
-- ---------------------------------------------------------------------------
create table if not exists public.context_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  question text not null,
  why_needed text,
  related_control_ids uuid[] not null default '{}',
  answer text,
  answered_by uuid references public.profiles (id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.context_questions enable row level security;

drop policy if exists "context questions readable by authenticated" on public.context_questions;
create policy "context questions readable by authenticated"
  on public.context_questions for select to authenticated using (true);

drop policy if exists "context questions insertable by authenticated" on public.context_questions;
create policy "context questions insertable by authenticated"
  on public.context_questions for insert to authenticated with check (true);

drop policy if exists "context questions updatable by authenticated" on public.context_questions;
create policy "context questions updatable by authenticated"
  on public.context_questions for update to authenticated using (true) with check (true);

drop policy if exists "context questions deletable by authenticated" on public.context_questions;
create policy "context questions deletable by authenticated"
  on public.context_questions for delete to authenticated using (true);
