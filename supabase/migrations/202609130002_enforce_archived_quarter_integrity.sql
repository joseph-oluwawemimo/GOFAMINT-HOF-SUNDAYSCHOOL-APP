-- Enforce quarter lifecycle integrity in the database. UI controls are not a
-- security boundary: class logins must not be able to change grades or
-- offerings after the corresponding quarter is archived or while it is
-- upcoming. Annual rollover clears these tables, so operational rows always
-- belong to the one current Sunday School year.
create or replace function public.is_active_quarter_number(target_quarter integer)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    exists (
      select 1
      from public.sunday_school_years year_record
      cross join lateral jsonb_array_elements(
        coalesce(year_record.data -> 'quarters', '[]'::jsonb)
      ) as quarter_record
      where (quarter_record ->> 'quarterNumber') ~ '^[1-4]$'
        and (quarter_record ->> 'quarterNumber')::integer = target_quarter
        and upper(coalesce(quarter_record ->> 'status', '')) = 'ACTIVE'
    ),
    false
  )
$$;

revoke all on function public.is_active_quarter_number(integer) from public, anon;
grant execute on function public.is_active_quarter_number(integer) to authenticated;

drop policy if exists grades_create on public.grades;
drop policy if exists grades_update on public.grades;
drop policy if exists grades_delete on public.grades;

create policy grades_create on public.grades
for insert
with check (
  public.is_active_quarter_number(quarter_number)
  and (public.is_record_officer() or public.is_assigned_to_class(class_id))
);

create policy grades_update on public.grades
for update
using (
  public.is_active_quarter_number(quarter_number)
  and (public.is_record_officer() or public.is_assigned_to_class(class_id))
)
with check (
  public.is_active_quarter_number(quarter_number)
  and (public.is_record_officer() or public.is_assigned_to_class(class_id))
);

create policy grades_delete on public.grades
for delete
using (
  public.is_active_quarter_number(quarter_number)
  and (public.is_exec_admin() or public.is_assigned_to_class(class_id))
);

drop policy if exists offerings_create on public.offerings;
drop policy if exists offerings_update on public.offerings;
drop policy if exists offerings_delete on public.offerings;

create policy offerings_create on public.offerings
for insert
with check (
  public.is_active_quarter_number(quarter_number)
  and (public.is_treasurer() or public.is_assigned_to_class(class_id))
);

create policy offerings_update on public.offerings
for update
using (
  public.is_active_quarter_number(quarter_number)
  and (public.is_treasurer() or public.is_assigned_to_class(class_id))
)
with check (
  public.is_active_quarter_number(quarter_number)
  and (public.is_treasurer() or public.is_assigned_to_class(class_id))
);

create policy offerings_delete on public.offerings
for delete
using (
  public.is_active_quarter_number(quarter_number)
  and public.is_treasurer()
);
