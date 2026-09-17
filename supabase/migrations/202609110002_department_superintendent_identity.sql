-- Identity/schema half of Departmental Superintendent support. Kept separate
-- because PostgreSQL requires a newly-added enum value to be committed before
-- it is referenced by policies, functions, or indexes.
alter type public.gofamint_role add value if not exists 'DEPARTMENT_SUPERINTENDENT';

alter table public.profiles
  add column if not exists department_id text references public.departments(id);

alter table public.admin_profiles
  add column if not exists department_id text references public.departments(id);

create index if not exists profiles_department_idx on public.profiles(department_id);
create index if not exists admin_profiles_department_idx on public.admin_profiles(department_id);

