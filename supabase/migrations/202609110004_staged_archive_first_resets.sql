-- Archive-first, transaction-bound staged resets. This function is server-only;
-- the API performs role and exact-phrase checks before invoking it.
create or replace function public.gofamint_staged_reset(p_scope text, p_actor_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare
  v_scope text := upper(trim(p_scope));
  v_archive_id text := 'RESET_' || upper(trim(p_scope)) || '_' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS') || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  v_snapshot jsonb;
  v_counts jsonb;
begin
  if v_scope not in ('CLASSES', 'WORKERS', 'ADMINS', 'FULL') then
    raise exception 'Unsupported reset scope.';
  end if;
  perform pg_advisory_xact_lock(hashtext('gofamint-staged-reset'));

  select jsonb_build_object(
    'scope', v_scope, 'archivedAt', now(), 'archivedBy', p_actor_id,
    'profiles', coalesce((select jsonb_agg(to_jsonb(t)) from public.profiles t), '[]'::jsonb),
    'adminProfiles', coalesce((select jsonb_agg(to_jsonb(t)) from public.admin_profiles t), '[]'::jsonb),
    'years', coalesce((select jsonb_agg(to_jsonb(t)) from public.sunday_school_years t), '[]'::jsonb),
    'departments', coalesce((select jsonb_agg(to_jsonb(t)) from public.departments t), '[]'::jsonb),
    'classes', coalesce((select jsonb_agg(to_jsonb(t)) from public.classes t), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(to_jsonb(t)) from public.members t), '[]'::jsonb),
    'grades', coalesce((select jsonb_agg(to_jsonb(t)) from public.grades t), '[]'::jsonb),
    'offerings', coalesce((select jsonb_agg(to_jsonb(t)) from public.offerings t), '[]'::jsonb),
    'absenceLogs', coalesce((select jsonb_agg(to_jsonb(t)) from public.absence_logs t), '[]'::jsonb),
    'referrals', coalesce((select jsonb_agg(to_jsonb(t)) from public.referrals t), '[]'::jsonb),
    'workers', coalesce((select jsonb_agg(to_jsonb(t)) from public.workers t), '[]'::jsonb),
    'workerAttendance', coalesce((select jsonb_agg(to_jsonb(t)) from public.worker_attendance t), '[]'::jsonb),
    'workerPrepAttendance', coalesce((select jsonb_agg(to_jsonb(t)) from public.worker_prep_attendance t), '[]'::jsonb),
    'specialEvents', coalesce((select jsonb_agg(to_jsonb(t)) from public.special_events t), '[]'::jsonb),
    'specialEventAttendance', coalesce((select jsonb_agg(to_jsonb(t)) from public.special_event_attendance t), '[]'::jsonb),
    'adminComments', coalesce((select jsonb_agg(to_jsonb(t)) from public.admin_comments t), '[]'::jsonb),
    'enrollmentCertifications', coalesce((select jsonb_agg(to_jsonb(t)) from public.enrollment_certifications t), '[]'::jsonb),
    'treasuryExpenditures', coalesce((select jsonb_agg(to_jsonb(t)) from public.treasury_expenditures t), '[]'::jsonb),
    'lessons', coalesce((select jsonb_agg(to_jsonb(t)) from public.lessons t), '[]'::jsonb),
    'auditLogs', coalesce((select jsonb_agg(to_jsonb(t)) from public.audit_logs t), '[]'::jsonb)
  ) into v_snapshot;

  select jsonb_build_object(
    'profiles', (select count(*) from public.profiles),
    'classes', (select count(*) from public.classes),
    'members', (select count(*) from public.members),
    'workers', (select count(*) from public.workers),
    'grades', (select count(*) from public.grades)
  ) into v_counts;

  insert into public.sunday_school_year_archives(id, data, archived_at)
  values (v_archive_id, jsonb_build_object('resetArchive', true, 'scope', v_scope, 'preResetCounts', v_counts, 'snapshot', v_snapshot), now());

  if v_scope = 'CLASSES' then
    update public.profiles set created_by = null where created_by in (
      select id from public.profiles where role::text in ('TEACHER','CLASS_SECRETARY','TEACHER / CLASS_SECRETARY')
    );
    update public.profiles set approved_by = null where approved_by in (
      select id from public.profiles where role::text in ('TEACHER','CLASS_SECRETARY','TEACHER / CLASS_SECRETARY')
    );
    update public.admin_profiles set approved_by = null where approved_by in (
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
    delete from public.classes;
  elsif v_scope = 'WORKERS' then
    update public.profiles set created_by = null where created_by in (select id from public.profiles where role::text = 'WORKER');
    update public.profiles set approved_by = null where approved_by in (select id from public.profiles where role::text = 'WORKER');
    update public.admin_profiles set approved_by = null where approved_by in (select id from public.profiles where role::text = 'WORKER');
    update public.audit_logs set actor_id = null where actor_id in (select id from public.profiles where role::text = 'WORKER');
    delete from auth.users where id in (select id from public.profiles where role::text = 'WORKER');
    update public.profiles set worker_id = null where worker_id is not null;
    delete from public.special_event_attendance;
    delete from public.special_events;
    delete from public.worker_attendance;
    delete from public.worker_prep_attendance;
    delete from public.workers;
    delete from public.worker_categories;
    delete from public.clock_in_config;
  elsif v_scope = 'ADMINS' then
    update public.profiles set created_by = null where created_by in (
      select id from public.profiles where role::text in ('SUPER_ADMIN','GENERAL_SECRETARY','DEPARTMENT_SUPERINTENDENT','ASST_GENERAL_SECRETARY','ASSISTANT_GENERAL_SECRETARY','RECORD_OFFICER','ENROLLMENT_OFFICER','TREASURER')
    );
    update public.profiles set approved_by = null where approved_by in (
      select id from public.profiles where role::text in ('SUPER_ADMIN','GENERAL_SECRETARY','DEPARTMENT_SUPERINTENDENT','ASST_GENERAL_SECRETARY','ASSISTANT_GENERAL_SECRETARY','RECORD_OFFICER','ENROLLMENT_OFFICER','TREASURER')
    );
    update public.admin_profiles set approved_by = null where approved_by in (
      select id from public.profiles where role::text in ('SUPER_ADMIN','GENERAL_SECRETARY','DEPARTMENT_SUPERINTENDENT','ASST_GENERAL_SECRETARY','ASSISTANT_GENERAL_SECRETARY','RECORD_OFFICER','ENROLLMENT_OFFICER','TREASURER')
    );
    update public.audit_logs set actor_id = null where actor_id in (
      select id from public.profiles where role::text in ('SUPER_ADMIN','GENERAL_SECRETARY','DEPARTMENT_SUPERINTENDENT','ASST_GENERAL_SECRETARY','ASSISTANT_GENERAL_SECRETARY','RECORD_OFFICER','ENROLLMENT_OFFICER','TREASURER')
    );
    delete from auth.users where id in (
      select id from public.profiles where role::text in ('SUPER_ADMIN','GENERAL_SECRETARY','DEPARTMENT_SUPERINTENDENT','ASST_GENERAL_SECRETARY','ASSISTANT_GENERAL_SECRETARY','RECORD_OFFICER','ENROLLMENT_OFFICER','TREASURER')
    );
  else
    update public.profiles set created_by = null, approved_by = null;
    update public.admin_profiles set approved_by = null;
    update public.audit_logs set actor_id = null;
    delete from auth.users;
    delete from public.special_event_attendance;
    delete from public.special_events;
    delete from public.worker_attendance;
    delete from public.worker_prep_attendance;
    delete from public.workers;
    delete from public.worker_categories;
    delete from public.clock_in_config;
    delete from public.classes;
    delete from public.lessons;
    delete from public.treasury_expenditures;
    delete from public.sunday_school_years;
    delete from public.departments;
    delete from public.system_config;
    delete from public.audit_logs;
  end if;

  return jsonb_build_object('scope', v_scope, 'archiveId', v_archive_id, 'preResetCounts', v_counts);
end;
$$;

revoke all on function public.gofamint_staged_reset(text, uuid) from public, anon, authenticated;

create or replace function public.gofamint_list_archive_metadata()
returns table(id text, archived_at timestamptz, archive_type text, scope text, summary jsonb)
language sql stable security definer set search_path = public as $$
  select a.id,
         a.archived_at,
         case when coalesce((a.data ->> 'resetArchive')::boolean, false) then 'STAGED_RESET' else 'YEAR_ARCHIVE' end,
         coalesce(a.data ->> 'scope', a.data #>> '{snapshot,scope}', 'YEAR'),
         coalesce(a.data -> 'preResetCounts', '{}'::jsonb)
  from public.sunday_school_year_archives a
  order by a.archived_at desc
$$;
revoke all on function public.gofamint_list_archive_metadata() from public, anon, authenticated;
