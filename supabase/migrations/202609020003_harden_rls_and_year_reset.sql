-- Follow-up security and lifecycle migration.  This deliberately leaves the
-- foundation migration intact and never changes existing application data.

-- Teachers may read their own identity but must not enumerate staff profiles.
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select using (
  id = auth.uid() or public.is_any_admin()
);

-- Administrative identity metadata is not a worker directory.
drop policy if exists admin_profiles_read on public.admin_profiles;
create policy admin_profiles_read on public.admin_profiles for select using (
  public.is_any_admin()
);

-- Class-level referrals must follow the same class isolation as members.
drop policy if exists referrals_read on public.referrals;
drop policy if exists referrals_create on public.referrals;
drop policy if exists referrals_update on public.referrals;
drop policy if exists referrals_delete on public.referrals;
create policy referrals_read on public.referrals for select using (
  public.is_any_admin() or public.is_assigned_to_class(class_id)
);
create policy referrals_create on public.referrals for insert with check (
  public.is_any_admin() or public.is_assigned_to_class(class_id)
);
create policy referrals_update on public.referrals for update using (
  public.is_any_admin() or public.is_assigned_to_class(class_id)
) with check (public.is_any_admin() or public.is_assigned_to_class(class_id));
create policy referrals_delete on public.referrals for delete using (
  public.is_exec_admin() or public.is_assigned_to_class(class_id)
);

-- A worker sees their own worker record; directorate roles retain operational
-- visibility.  This prevents a normal worker from downloading the directory.
drop policy if exists workers_read on public.workers;
create policy workers_read on public.workers for select using (
  public.is_any_admin() or public.is_own_worker(id)
);

-- Server-only reset procedure.  The API verifies the caller role before using
-- this service-role RPC; it is not executable by anonymous/authenticated users.
create or replace function public.gofamint_reset_year(
  p_confirm_year_id text,
  p_new_year_name text,
  p_new_overall_theme text,
  p_actor_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_current_year_id text;
  v_new_year_id text := 'YEAR_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  v_old_year jsonb;
  v_snapshot jsonb;
  v_quarters jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('gofamint-year-reset'));
  select data ->> 'currentYearId' into v_current_year_id from public.system_config where id = 'initialization' for update;
  if v_current_year_id is null or v_current_year_id <> p_confirm_year_id then
    raise exception 'The requested year is no longer the active Sunday School year.';
  end if;
  select data into v_old_year from public.sunday_school_years where id = v_current_year_id;
  if v_old_year is null then raise exception 'The active Sunday School year was not found.'; end if;

  select jsonb_build_object(
    'year', v_old_year,
    'classes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'data', data)) from public.classes), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'classId', class_id, 'data', data)) from public.members), '[]'::jsonb),
    'grades', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'classId', class_id, 'memberId', member_id, 'data', data)) from public.grades), '[]'::jsonb),
    'offerings', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'classId', class_id, 'data', data)) from public.offerings), '[]'::jsonb),
    'absenceLogs', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'classId', class_id, 'memberId', member_id, 'data', data)) from public.absence_logs), '[]'::jsonb),
    'workerAttendance', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'workerId', worker_id, 'data', data)) from public.worker_attendance), '[]'::jsonb),
    'workerPrepAttendance', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'workerId', worker_id, 'data', data)) from public.worker_prep_attendance), '[]'::jsonb)
  ) into v_snapshot;
  insert into public.sunday_school_year_archives(id, data) values (
    'ARCHIVE_' || v_current_year_id || '_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    jsonb_build_object('archivedBy', p_actor_id, 'archivedAt', now(), 'snapshot', v_snapshot)
  );

  -- Annual operational records are archived above before being cleared. Core
  -- organizational entities (classes, members, workers, identities) remain.
  delete from public.grades;
  delete from public.offerings;
  delete from public.absence_logs;
  delete from public.worker_attendance;
  delete from public.worker_prep_attendance;
  delete from public.lessons where year_id = v_current_year_id;
  delete from public.sunday_school_years where id = v_current_year_id;

  select jsonb_agg(jsonb_build_object(
    'id', 'Q' || n || '_' || v_new_year_id, 'quarterNumber', n,
    'quarterName', case n when 1 then 'First Quarter' when 2 then 'Second Quarter' when 3 then 'Third Quarter' else 'Fourth Quarter' end,
    'quarterTheme', '', 'startDate', '', 'endDate', '', 'sharingAdmonitionDate', '',
    'totalLessonWeeks', 12, 'hasSharingAdmonitionWeek', true,
    'status', case when n = 1 then 'ACTIVE' else 'UPCOMING' end,
    'isDistributed', false, 'lessons', '[]'::jsonb, 'updatedAt', now()
  )) into v_quarters from generate_series(1, 4) as n;
  insert into public.sunday_school_years(id, data, updated_at) values (
    v_new_year_id,
    jsonb_build_object('id', v_new_year_id, 'yearName', p_new_year_name, 'overallTheme', coalesce(p_new_overall_theme, ''), 'startDate', '', 'endDate', '', 'activeQuarterNumber', 1, 'isInitialized', false, 'departments', '[]'::jsonb, 'quarters', v_quarters, 'updatedAt', now()), now()
  );
  update public.system_config set data = jsonb_set(data, '{currentYearId}', to_jsonb(v_new_year_id), true), updated_at = now() where id = 'initialization';
  return jsonb_build_object('new_year_id', v_new_year_id);
end;
$$;
revoke all on function public.gofamint_reset_year(text, text, text, uuid) from public, anon, authenticated;
