create table if not exists public.enrollment_certifications (
  id text primary key,
  member_id text not null references public.members(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  quarter_number integer not null check (quarter_number between 1 and 4),
  week_number integer not null check (week_number between 1 and 13),
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists enrollment_certifications_member_idx
  on public.enrollment_certifications(member_id, quarter_number, week_number);

alter table public.enrollment_certifications enable row level security;

create policy enrollment_certifications_read
  on public.enrollment_certifications for select
  using (public.is_any_admin() or public.is_assigned_to_class(class_id));

create policy enrollment_certifications_create
  on public.enrollment_certifications for insert
  with check (public.is_enrollment_officer());

alter publication supabase_realtime add table public.enrollment_certifications;
