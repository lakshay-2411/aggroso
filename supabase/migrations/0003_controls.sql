-- 0003: control register, owners, evidence, and remediation status.
-- Run in the Supabase SQL editor after 0002.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'remediation_status') then
    create type public.remediation_status as enum (
      'not_started',
      'in_progress',
      'remediated',
      'risk_accepted',
      'not_applicable'
    );
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Controls (or processes / systems). The bounded set that policies are
-- assessed against. `revision` increases on every meaningful change so that
-- assessments can detect when a control changed after they were made.
-- ---------------------------------------------------------------------------
create table if not exists public.controls (
  id uuid primary key default gen_random_uuid(),
  control_ref text not null unique,
  title text not null,
  description text,
  category text,
  owner_id uuid references public.profiles (id) on delete set null,
  owner_name text,
  remediation_status public.remediation_status not null default 'not_started',
  remediation_notes text,
  is_active boolean not null default true,
  revision integer not null default 1,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists controls_owner_idx on public.controls (owner_id);
create index if not exists controls_status_idx on public.controls (remediation_status);

-- Bump revision whenever a tracked column changes.
create or replace function public.bump_control_revision()
returns trigger
language plpgsql
as $$
begin
  if row(new.control_ref, new.title, new.description, new.category,
         new.owner_id, new.owner_name, new.remediation_status,
         new.remediation_notes, new.is_active)
     is distinct from
     row(old.control_ref, old.title, old.description, old.category,
         old.owner_id, old.owner_name, old.remediation_status,
         old.remediation_notes, old.is_active)
  then
    new.revision = old.revision + 1;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists controls_bump_revision on public.controls;
create trigger controls_bump_revision
  before update on public.controls
  for each row execute function public.bump_control_revision();

alter table public.controls enable row level security;

drop policy if exists "controls readable by authenticated" on public.controls;
create policy "controls readable by authenticated"
  on public.controls for select to authenticated using (true);

drop policy if exists "controls insertable by authenticated" on public.controls;
create policy "controls insertable by authenticated"
  on public.controls for insert to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "controls updatable by authenticated" on public.controls;
create policy "controls updatable by authenticated"
  on public.controls for update to authenticated
  using (true) with check (true);

-- Controls are deactivated, never deleted, so assessment history stays intact.

-- ---------------------------------------------------------------------------
-- Evidence attached to a control. Each row is one artefact (document, log
-- export, screenshot location, ticket) with the date it was produced.
-- ---------------------------------------------------------------------------
create table if not exists public.control_evidence (
  id uuid primary key default gen_random_uuid(),
  control_id uuid not null references public.controls (id) on delete cascade,
  title text not null,
  description text,
  evidence_date date,
  reference text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists control_evidence_control_idx
  on public.control_evidence (control_id, evidence_date desc);

alter table public.control_evidence enable row level security;

drop policy if exists "evidence readable by authenticated" on public.control_evidence;
create policy "evidence readable by authenticated"
  on public.control_evidence for select to authenticated using (true);

drop policy if exists "evidence insertable by authenticated" on public.control_evidence;
create policy "evidence insertable by authenticated"
  on public.control_evidence for insert to authenticated
  with check (auth.uid() = created_by);

drop policy if exists "evidence deletable by authenticated" on public.control_evidence;
create policy "evidence deletable by authenticated"
  on public.control_evidence for delete to authenticated using (true);

-- Evidence changes count as a change to the control.
create or replace function public.touch_control_on_evidence_change()
returns trigger
language plpgsql
as $$
declare
  target uuid := coalesce(new.control_id, old.control_id);
begin
  update public.controls
     set revision = revision + 1,
         updated_at = now()
   where id = target;
  return coalesce(new, old);
end;
$$;

drop trigger if exists control_evidence_touch_control on public.control_evidence;
create trigger control_evidence_touch_control
  after insert or delete on public.control_evidence
  for each row execute function public.touch_control_on_evidence_change();
