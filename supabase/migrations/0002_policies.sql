-- 0002: policies and immutable policy versions.
-- Run in the Supabase SQL editor after 0001.

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists policies_set_updated_at on public.policies;
create trigger policies_set_updated_at
  before update on public.policies
  for each row execute function public.set_updated_at();

alter table public.policies enable row level security;

drop policy if exists "policies readable by authenticated" on public.policies;
create policy "policies readable by authenticated"
  on public.policies for select to authenticated using (true);

drop policy if exists "policies insertable by authenticated" on public.policies;
create policy "policies insertable by authenticated"
  on public.policies for insert to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "policies updatable by authenticated" on public.policies;
create policy "policies updatable by authenticated"
  on public.policies for update to authenticated
  using (true) with check (true);

-- Policies are never deleted: versions and assessments must be preserved.

-- ---------------------------------------------------------------------------
-- Policy versions. Each row is a full snapshot of the policy text at a point
-- in time. Rows are immutable: no update or delete policies exist.
-- ---------------------------------------------------------------------------
create table if not exists public.policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies (id) on delete restrict,
  version_number integer not null,
  label text not null,
  effective_date date,
  change_summary text,
  content text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (policy_id, version_number)
);

create index if not exists policy_versions_policy_idx
  on public.policy_versions (policy_id, version_number desc);

alter table public.policy_versions enable row level security;

drop policy if exists "policy versions readable by authenticated" on public.policy_versions;
create policy "policy versions readable by authenticated"
  on public.policy_versions for select to authenticated using (true);

drop policy if exists "policy versions insertable by authenticated" on public.policy_versions;
create policy "policy versions insertable by authenticated"
  on public.policy_versions for insert to authenticated
  with check (auth.uid() = created_by);

-- Guard immutability at the database level as well.
create or replace function public.prevent_policy_version_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'policy_versions rows are immutable';
end;
$$;

drop trigger if exists policy_versions_immutable on public.policy_versions;
create trigger policy_versions_immutable
  before update or delete on public.policy_versions
  for each row execute function public.prevent_policy_version_mutation();

-- Allocate the next version number atomically per policy.
create or replace function public.next_policy_version_number(p_policy_id uuid)
returns integer
language sql
stable
as $$
  select coalesce(max(version_number), 0) + 1
  from public.policy_versions
  where policy_id = p_policy_id;
$$;
