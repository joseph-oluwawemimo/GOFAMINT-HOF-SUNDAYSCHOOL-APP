-- Correct annual rollover so the active year is genuinely fresh while the
-- complete outgoing year remains retrievable from its archive.
create or replace function public.gofamint_reset_year(
  p_confirm_year_id text,
  p_new_year_name text,
  p_new_overall_theme text,
  p_actor_id uuid
) returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_current_year_id text;
  v_new_year_id text := 'YEAR_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  v_old_year jsonb;
  v_snapshot jsonb;
  v_quarters jsonb;
  v_class_count integer;
  v_worker_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('gofamint-year-reset'));
  select data ->> 'currentYearId' into v_current_year_id
  from public.system_config where id = 'initialization' for update;
  if v_current_year_id is null or v_current_year_id <> p_confirm_year_id then
    raise exception 'The requested year is no longer the active Sunday School year.';
  end if;
  select data into v_old_year from public.sunday_school_years where id = v_current_year_id;
  if v_old_year is null then raise exception 'The active Sunday School year was not found.'; end if;

  select count(*) into v_class_count from public.classes;
  select count(*) into v_worker_count from public.workers;
  select jsonb_build_object(
    'year', v_old_year,
    'classes', coalesce((select jsonb_agg(to_jsonb(t)) from public.classes t), '[]'::jsonb),
    'classLogins', coalesce((select jsonb_agg(to_jsonb(t)) from public.profiles t where role::text in ('TEACHER','CLASS_SECRETARY','TEACHER / CLASS_SECRETARY')), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(to_jsonb(t)) from public.members t), '[]'::jsonb),
    'grades', coalesce((select jsonb_agg(to_jsonb(t)) from public.grades t), '[]'::jsonb),
    'offerings', coalesce((select jsonb_agg(to_jsonb(t)) from public.offerings t), '[]'::jsonb),
    'absenceLogs', coalesce((select jsonb_agg(to_jsonb(t)) from public.absence_logs t), '[]'::jsonb),
    'referrals', coalesce((select jsonb_agg(to_jsonb(t)) from public.referrals t), '[]'::jsonb),
    'enrollmentCertifications', coalesce((select jsonb_agg(to_jsonb(t)) from public.enrollment_certifications t), '[]'::jsonb),
    'workers', coalesce((select jsonb_agg(to_jsonb(t)) from public.workers t), '[]'::jsonb),
    'workerAttendance', coalesce((select jsonb_agg(to_jsonb(t)) from public.worker_attendance t), '[]'::jsonb),
    'workerPrepAttendance', coalesce((select jsonb_agg(to_jsonb(t)) from public.worker_prep_attendance t), '[]'::jsonb),
    'specialEvents', coalesce((select jsonb_agg(to_jsonb(t)) from public.special_events t), '[]'::jsonb),
    'specialEventAttendance', coalesce((select jsonb_agg(to_jsonb(t)) from public.special_event_attendance t), '[]'::jsonb),
    'adminComments', coalesce((select jsonb_agg(to_jsonb(t)) from public.admin_comments t), '[]'::jsonb),
    'treasuryExpenditures', coalesce((select jsonb_agg(to_jsonb(t)) from public.treasury_expenditures t), '[]'::jsonb),
    'lessons', coalesce((select jsonb_agg(to_jsonb(t)) from public.lessons t where year_id = v_current_year_id), '[]'::jsonb)
  ) into v_snapshot;

  insert into public.sunday_school_year_archives(id, data)
  values (
    'ARCHIVE_' || v_current_year_id || '_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
    jsonb_build_object('archiveType', 'YEAR_ROLLOVER', 'archivedBy', p_actor_id, 'archivedAt', now(), 'snapshot', v_snapshot)
  );

  -- Class login identities are annual assignments. Remove them, while keeping
  -- administrative and worker identities intact.
  update public.profiles set created_by = null where created_by in (
    select id from public.profiles where role::text in ('TEACHER','CLASS_SECRETARY','TEACHER / CLASS_SECRETARY')
  );
  update public.profiles set approved_by = null where approved_by in (
    select id from public.profiles where role::text in ('TEACHER','CLASS_SECRETARY','TEACHER / CLASS_SECRETARY')
  );
  update public.admin_profiles set approved_by = null where approved_by in (
    select id from public.profiles where role::text in ('TEACHER','CLASS_SECRETARY','TEACHER / CLASS_SECRETARY')
  );
  update public.audit_logs set actor_id = null where actor_id in (
    select id from public.profiles where role::text in ('TEACHER','CLASS_SECRETARY','TEACHER / CLASS_SECRETARY')
  );
  delete from auth.users where id in (
    select id from public.profiles where role::text in ('TEACHER','CLASS_SECRETARY','TEACHER / CLASS_SECRETARY')
  );

  -- Clear annual operational records only after the complete snapshot exists.
  delete from public.special_event_attendance;
  delete from public.special_events;
  delete from public.worker_attendance;
  delete from public.worker_prep_attendance;
  delete from public.referrals;
  delete from public.admin_comments;
  delete from public.treasury_expenditures;
  delete from public.members; -- cascades grades, absence logs, and certifications
  delete from public.offerings;
  delete from public.lessons where year_id = v_current_year_id;
  delete from public.sunday_school_years where id = v_current_year_id;

  -- Retain organizational directories but clear the outgoing annual assignment.
  update public.classes
  set data = (data - array['teachers','secretaryName','secretaryPhone','password','quarterTitle']) ||
      jsonb_build_object('teachers', '[]'::jsonb, 'secretaryName', '', 'secretaryPhone', '', 'isSetupComplete', false, 'updatedAt', now()),
      updated_at = now();
  update public.workers
  set data = (data - array['assignedClass','duty','categories']) ||
      jsonb_build_object('assignedClass', '', 'duty', '', 'categories', '[]'::jsonb, 'updatedAt', now()),
      updated_at = now();

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
    jsonb_build_object(
      'id', v_new_year_id, 'yearName', trim(p_new_year_name),
      'overallTheme', coalesce(trim(p_new_overall_theme), ''),
      'startDate', '', 'endDate', '', 'activeQuarterNumber', 1,
      'isInitialized', true,
      'departments', coalesce(v_old_year -> 'departments', '[]'::jsonb),
      'quarters', v_quarters, 'updatedAt', now()
    ), now()
  );
  update public.system_config
  set data = jsonb_set(data, '{currentYearId}', to_jsonb(v_new_year_id), true), updated_at = now()
  where id = 'initialization';

  return jsonb_build_object(
    'new_year_id', v_new_year_id,
    'classes_reassigned', v_class_count,
    'workers_reassigned', v_worker_count
  );
end;
$$;

revoke all on function public.gofamint_reset_year(text, text, text, uuid) from public, anon, authenticated;
