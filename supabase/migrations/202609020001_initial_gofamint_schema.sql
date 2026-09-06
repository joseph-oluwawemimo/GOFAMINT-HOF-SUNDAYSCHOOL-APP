-- GOFAMINT Supabase foundation.  This file is intentionally NOT applied by
-- the application; apply it only to the designated Supabase project after review.
create extension if not exists pgcrypto;

create type public.gofamint_role as enum (
  'SUPER_ADMIN', 'GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY',
  'ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY', 'RECORD_OFFICER',
  'ENROLLMENT_OFFICER', 'TREASURER', 'TEACHER', 'CLASS_SECRETARY', 'WORKER',
  'TEACHER / CLASS_SECRETARY'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null, display_name text, role public.gofamint_role not null,
  is_approved boolean not null default false, class_id text, worker_id text,
  created_by uuid references auth.users(id), approved_by uuid references auth.users(id),
  approved_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.admin_profiles (id text primary key, profile_id uuid unique references public.profiles(id) on delete cascade, role_type public.gofamint_role not null, title text not null, profile_name text not null, username text not null unique, photo_base64 text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.system_config (id text primary key, data jsonb not null default '{}'::jsonb, initialized boolean not null default false, schema_version integer not null default 1, updated_at timestamptz not null default now());
create table public.sunday_school_years (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table public.sunday_school_year_archives (id text primary key, data jsonb not null, archived_at timestamptz not null default now());
create table public.departments (id text primary key, name text not null unique, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
create table public.classes (id text primary key, department_id text references public.departments(id), data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.profile_class_assignments (profile_id uuid references public.profiles(id) on delete cascade, class_id text references public.classes(id) on delete cascade, primary key(profile_id, class_id));
create table public.members (id text primary key, class_id text references public.classes(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.grades (id text primary key, class_id text references public.classes(id) on delete cascade, member_id text references public.members(id) on delete cascade, quarter_number integer, week_number integer, data jsonb not null, updated_at timestamptz not null default now());
create table public.offerings (id text primary key, class_id text references public.classes(id) on delete cascade, quarter_number integer, week_number integer, data jsonb not null, updated_at timestamptz not null default now());
create table public.absence_logs (id text primary key, class_id text references public.classes(id) on delete cascade, member_id text references public.members(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());
create table public.referrals (id text primary key, class_id text references public.classes(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());
create table public.workers (id text primary key, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.worker_attendance (id text primary key, worker_id text references public.workers(id) on delete cascade, service_date date, data jsonb not null, created_at timestamptz not null default now());
create table public.worker_prep_attendance (id text primary key, worker_id text references public.workers(id) on delete cascade, prep_date date, data jsonb not null, updated_at timestamptz not null default now());
create table public.clock_in_config (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table public.worker_categories (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table public.special_events (id text primary key, data jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.special_event_attendance (id text primary key, event_id text references public.special_events(id) on delete cascade, worker_id text references public.workers(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());
create table public.admin_comments (id text primary key, class_id text references public.classes(id) on delete cascade, data jsonb not null, created_at timestamptz not null default now());
create table public.treasury_expenditures (id text primary key, data jsonb not null, created_at timestamptz not null default now());
create table public.lessons (id text primary key, year_id text references public.sunday_school_years(id) on delete cascade, week_number integer, data jsonb not null, updated_at timestamptz not null default now());
create table public.audit_logs (id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id), action text not null, entity_type text, entity_id text, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());

create index grades_class_idx on public.grades(class_id, quarter_number, week_number);
create index members_class_idx on public.members(class_id);
create index offerings_class_idx on public.offerings(class_id, quarter_number, week_number);
create index worker_attendance_worker_idx on public.worker_attendance(worker_id, service_date);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

-- Role helpers mirror firestore.rules' hierarchy. A profile is authoritative only
-- after server-side approval; all role and assignment writes remain server-only.
create or replace function public.current_role() returns public.gofamint_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_approved = true
$$;
create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() = 'SUPER_ADMIN'
$$;
create or replace function public.is_general_superintendent() returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('SUPER_ADMIN', 'GENERAL_SUPERINTENDENT')
$$;
create or replace function public.is_general_secretary() returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('SUPER_ADMIN', 'GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY')
$$;
create or replace function public.is_assistant_general_secretary() returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('SUPER_ADMIN', 'GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY', 'ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY')
$$;
create or replace function public.is_treasurer() returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('SUPER_ADMIN', 'GENERAL_SUPERINTENDENT', 'TREASURER')
$$;
create or replace function public.is_record_officer() returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('SUPER_ADMIN', 'GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY', 'RECORD_OFFICER')
$$;
create or replace function public.is_enrollment_officer() returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('SUPER_ADMIN', 'GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY', 'ENROLLMENT_OFFICER')
$$;
create or replace function public.is_exec_admin() returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('SUPER_ADMIN', 'GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY')
$$;
create or replace function public.is_any_admin() returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('SUPER_ADMIN', 'GENERAL_SUPERINTENDENT', 'GENERAL_SECRETARY', 'ASST_GENERAL_SECRETARY', 'ASSISTANT_GENERAL_SECRETARY', 'RECORD_OFFICER', 'ENROLLMENT_OFFICER', 'TREASURER')
$$;
create or replace function public.is_teacher() returns boolean language sql stable security definer set search_path = public as $$
  select public.current_role() in ('TEACHER', 'CLASS_SECRETARY', 'TEACHER / CLASS_SECRETARY')
$$;
create or replace function public.is_assigned_to_class(target_class_id text) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_any_admin() or (
    public.is_teacher() and exists (
      select 1 from public.profile_class_assignments
      where profile_id = auth.uid() and class_id = target_class_id
    )
  )
$$;
create or replace function public.is_own_worker(target_worker_id text) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and worker_id = target_worker_id and is_approved = true)
$$;
create or replace function public.is_not_archived_record(record_data jsonb) returns boolean language sql immutable as $$
  select coalesce(record_data ->> 'isArchived', 'false') <> 'true'
     and coalesce(record_data ->> 'quarterStatus', '') <> 'ARCHIVED'
$$;

-- Every application table is protected. Tables with no client write policy are
-- intentionally service-role-only for bootstrap, approval, assignments, resets,
-- and audit logging.
alter table public.profiles enable row level security;
alter table public.admin_profiles enable row level security;
alter table public.system_config enable row level security;
alter table public.sunday_school_years enable row level security;
alter table public.sunday_school_year_archives enable row level security;
alter table public.departments enable row level security;
alter table public.classes enable row level security;
alter table public.profile_class_assignments enable row level security;
alter table public.members enable row level security;
alter table public.grades enable row level security;
alter table public.offerings enable row level security;
alter table public.absence_logs enable row level security;
alter table public.referrals enable row level security;
alter table public.workers enable row level security;
alter table public.worker_attendance enable row level security;
alter table public.worker_prep_attendance enable row level security;
alter table public.clock_in_config enable row level security;
alter table public.worker_categories enable row level security;
alter table public.special_events enable row level security;
alter table public.special_event_attendance enable row level security;
alter table public.admin_comments enable row level security;
alter table public.treasury_expenditures enable row level security;
alter table public.lessons enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_read on public.profiles for select using (id = auth.uid() or public.is_any_admin() or public.is_teacher());
create policy admin_profiles_read on public.admin_profiles for select using (auth.uid() is not null);
create policy admin_profiles_create on public.admin_profiles for insert with check (public.is_general_secretary());
create policy admin_profiles_update on public.admin_profiles for update using (public.is_general_superintendent()) with check (public.is_general_superintendent());
create policy admin_profiles_delete on public.admin_profiles for delete using (public.is_general_superintendent());

create policy system_config_read on public.system_config for select using (true);
create policy years_read on public.sunday_school_years for select using (auth.uid() is not null);
create policy years_create on public.sunday_school_years for insert with check (public.is_general_secretary());
create policy years_update on public.sunday_school_years for update using (public.is_general_secretary()) with check (public.is_general_secretary());
create policy years_delete on public.sunday_school_years for delete using (public.is_general_superintendent());
create policy year_archives_read on public.sunday_school_year_archives for select using (auth.uid() is not null);

create policy departments_read on public.departments for select using (auth.uid() is not null);
create policy departments_create on public.departments for insert with check (public.is_general_secretary());
create policy departments_update on public.departments for update using (public.is_general_secretary()) with check (public.is_general_secretary());
create policy departments_delete on public.departments for delete using (public.is_general_superintendent());
create policy classes_read on public.classes for select using (auth.uid() is not null);
create policy classes_create on public.classes for insert with check (public.is_general_secretary() or public.is_teacher());
create policy classes_update on public.classes for update using (public.is_general_secretary() or public.is_assigned_to_class(id)) with check (public.is_general_secretary() or public.is_assigned_to_class(id));
create policy classes_delete on public.classes for delete using (public.is_general_superintendent());
-- No client policy for profile_class_assignments: a client can never grant itself class access.

create policy members_read on public.members for select using (public.is_any_admin() or public.is_assigned_to_class(class_id));
create policy members_create on public.members for insert with check (public.is_any_admin() or public.is_enrollment_officer() or public.is_assigned_to_class(class_id));
create policy members_update on public.members for update using (public.is_any_admin() or public.is_enrollment_officer() or public.is_assigned_to_class(class_id)) with check (public.is_any_admin() or public.is_enrollment_officer() or public.is_assigned_to_class(class_id));
create policy members_delete on public.members for delete using (public.is_exec_admin() or public.is_assigned_to_class(class_id));

create policy grades_read on public.grades for select using (public.is_any_admin() or public.is_assigned_to_class(class_id));
create policy grades_create on public.grades for insert with check (public.is_record_officer() or (public.is_assigned_to_class(class_id) and public.is_not_archived_record(data)));
create policy grades_update on public.grades for update using (public.is_record_officer() or (public.is_assigned_to_class(class_id) and public.is_not_archived_record(data))) with check (public.is_record_officer() or (public.is_assigned_to_class(class_id) and public.is_not_archived_record(data)));
create policy grades_delete on public.grades for delete using (public.is_exec_admin() or (public.is_assigned_to_class(class_id) and public.is_not_archived_record(data)));

create policy offerings_read on public.offerings for select using (public.is_treasurer() or public.is_general_secretary() or public.is_record_officer() or public.is_assigned_to_class(class_id));
create policy offerings_create on public.offerings for insert with check (public.is_treasurer() or (public.is_assigned_to_class(class_id) and public.is_not_archived_record(data)));
create policy offerings_update on public.offerings for update using (public.is_treasurer() or (public.is_assigned_to_class(class_id) and public.is_not_archived_record(data))) with check (public.is_treasurer() or (public.is_assigned_to_class(class_id) and public.is_not_archived_record(data)));
create policy offerings_delete on public.offerings for delete using (public.is_treasurer());
create policy treasury_expenditures_access on public.treasury_expenditures for all using (public.is_treasurer()) with check (public.is_treasurer());

create policy absence_logs_access on public.absence_logs for all using (public.is_any_admin() or public.is_assigned_to_class(class_id)) with check (public.is_any_admin() or public.is_assigned_to_class(class_id));
create policy referrals_read on public.referrals for select using (public.is_any_admin() or public.is_enrollment_officer() or public.is_teacher());
create policy referrals_create on public.referrals for insert with check (public.is_any_admin() or public.is_enrollment_officer() or public.is_teacher());
create policy referrals_update on public.referrals for update using (public.is_any_admin() or public.is_enrollment_officer() or public.is_teacher()) with check (public.is_any_admin() or public.is_enrollment_officer() or public.is_teacher());
create policy referrals_delete on public.referrals for delete using (public.is_exec_admin() or public.is_enrollment_officer());

create policy lessons_read on public.lessons for select using (auth.uid() is not null);
create policy lessons_create on public.lessons for insert with check (public.is_general_secretary());
create policy lessons_update on public.lessons for update using (public.is_general_secretary()) with check (public.is_general_secretary());
create policy lessons_delete on public.lessons for delete using (public.is_general_superintendent());
create policy workers_read on public.workers for select using (auth.uid() is not null);
create policy workers_create on public.workers for insert with check (public.is_general_secretary() or public.is_own_worker(id));
create policy workers_update on public.workers for update using (public.is_general_secretary() or public.is_own_worker(id)) with check (public.is_general_secretary() or public.is_own_worker(id));
create policy workers_delete on public.workers for delete using (public.is_any_admin());

create policy worker_attendance_read on public.worker_attendance for select using (public.is_general_secretary() or public.is_own_worker(worker_id));
create policy worker_attendance_create on public.worker_attendance for insert with check (public.is_general_secretary() or public.is_own_worker(worker_id));
create policy worker_attendance_update on public.worker_attendance for update using (public.is_general_secretary()) with check (public.is_general_secretary());
create policy worker_attendance_delete on public.worker_attendance for delete using (public.is_any_admin());
create policy worker_prep_attendance_read on public.worker_prep_attendance for select using (public.is_general_secretary() or public.is_own_worker(worker_id));
create policy worker_prep_attendance_create on public.worker_prep_attendance for insert with check (public.is_general_secretary());
create policy worker_prep_attendance_update on public.worker_prep_attendance for update using (public.is_general_secretary()) with check (public.is_general_secretary());
create policy worker_prep_attendance_delete on public.worker_prep_attendance for delete using (public.is_any_admin());

create policy clock_in_config_read on public.clock_in_config for select using (auth.uid() is not null);
create policy clock_in_config_create on public.clock_in_config for insert with check (public.is_general_secretary());
create policy clock_in_config_update on public.clock_in_config for update using (public.is_general_secretary()) with check (public.is_general_secretary());
create policy clock_in_config_delete on public.clock_in_config for delete using (public.is_general_superintendent());
create policy worker_categories_read on public.worker_categories for select using (auth.uid() is not null);
create policy worker_categories_create on public.worker_categories for insert with check (public.is_general_secretary());
create policy worker_categories_update on public.worker_categories for update using (public.is_general_secretary()) with check (public.is_general_secretary());
create policy worker_categories_delete on public.worker_categories for delete using (public.is_general_superintendent());
create policy special_events_read on public.special_events for select using (auth.uid() is not null);
create policy special_events_create on public.special_events for insert with check (public.is_general_secretary());
create policy special_events_update on public.special_events for update using (public.is_general_secretary()) with check (public.is_general_secretary());
create policy special_events_delete on public.special_events for delete using (public.is_general_superintendent());
create policy special_event_attendance_read on public.special_event_attendance for select using (public.is_general_secretary() or public.is_own_worker(worker_id));
create policy special_event_attendance_create on public.special_event_attendance for insert with check (public.is_general_secretary() or public.is_own_worker(worker_id));
create policy special_event_attendance_update on public.special_event_attendance for update using (public.is_general_secretary()) with check (public.is_general_secretary());
create policy special_event_attendance_delete on public.special_event_attendance for delete using (public.is_general_superintendent());

create policy admin_comments_read on public.admin_comments for select using (public.is_any_admin() or public.is_assigned_to_class(class_id));
create policy admin_comments_create on public.admin_comments for insert with check (public.is_any_admin() or public.is_teacher());
create policy admin_comments_update on public.admin_comments for update using (public.is_any_admin() or public.is_teacher()) with check (public.is_any_admin() or public.is_teacher());
create policy admin_comments_delete on public.admin_comments for delete using (public.is_exec_admin() or data ->> 'authorId' = auth.uid()::text);
create policy audit_logs_read on public.audit_logs for select using (public.is_exec_admin());
