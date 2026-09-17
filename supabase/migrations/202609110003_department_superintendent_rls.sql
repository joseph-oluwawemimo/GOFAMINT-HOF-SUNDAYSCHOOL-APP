-- One approved, read-only Departmental Superintendent per department.
create unique index if not exists one_department_superintendent_per_department
  on public.profiles(department_id)
  where role = 'DEPARTMENT_SUPERINTENDENT' and department_id is not null;

create or replace function public.is_department_superintendent() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() = 'DEPARTMENT_SUPERINTENDENT'
$$;

create or replace function public.is_department_superintendent_for_class(target_class_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.profiles p
    join public.classes c on c.department_id = p.department_id
    where p.id = auth.uid()
      and p.is_approved = true
      and p.role = 'DEPARTMENT_SUPERINTENDENT'
      and c.id = target_class_id
  )
$$;

drop policy if exists classes_read on public.classes;
create policy classes_read on public.classes for select using (
  public.is_any_admin()
  or public.is_assigned_to_class(id)
  or public.is_department_superintendent_for_class(id)
);

drop policy if exists members_read on public.members;
create policy members_read on public.members for select using (
  public.is_any_admin()
  or public.is_assigned_to_class(class_id)
  or public.is_department_superintendent_for_class(class_id)
);

drop policy if exists grades_read on public.grades;
create policy grades_read on public.grades for select using (
  public.is_any_admin()
  or public.is_assigned_to_class(class_id)
  or public.is_department_superintendent_for_class(class_id)
);

-- The previous FOR ALL policy could not grant departmental read access without
-- also granting writes. Split it into explicit read-only and mutation policies.
drop policy if exists absence_logs_access on public.absence_logs;
create policy absence_logs_read on public.absence_logs for select using (
  public.is_any_admin()
  or public.is_assigned_to_class(class_id)
  or public.is_department_superintendent_for_class(class_id)
);
create policy absence_logs_create on public.absence_logs for insert with check (
  public.is_any_admin() or public.is_assigned_to_class(class_id)
);
create policy absence_logs_update on public.absence_logs for update using (
  public.is_any_admin() or public.is_assigned_to_class(class_id)
) with check (public.is_any_admin() or public.is_assigned_to_class(class_id));
create policy absence_logs_delete on public.absence_logs for delete using (
  public.is_any_admin() or public.is_assigned_to_class(class_id)
);

drop policy if exists referrals_read on public.referrals;
create policy referrals_read on public.referrals for select using (
  public.is_any_admin()
  or public.is_assigned_to_class(class_id)
  or public.is_department_superintendent_for_class(class_id)
);

drop policy if exists admin_comments_read on public.admin_comments;
create policy admin_comments_read on public.admin_comments for select using (
  public.is_any_admin()
  or public.is_assigned_to_class(class_id)
  or public.is_department_superintendent_for_class(class_id)
);

