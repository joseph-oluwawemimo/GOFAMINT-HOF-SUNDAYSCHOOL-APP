-- Reject authenticated writes from obsolete cached app bundles. Server/service
-- role operations remain available for protected APIs and migrations.
create or replace function public.reject_obsolete_client_write()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  incoming_version bigint;
  incoming_updated_at timestamptz;
  stored_updated_at timestamptz;
  expected_revision text;
  stored_revision text;
begin
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;

  incoming_version := nullif(new.data->>'_clientWriteVersion', '')::bigint;
  if incoming_version is null or incoming_version < 20261018 then
    raise exception using
      errcode = 'P0001',
      message = 'APP_UPDATE_REQUIRED: this cached app version cannot write to the live database';
  end if;

  if tg_op = 'UPDATE' then
    expected_revision := nullif(new.data->>'_expectedUpdatedAt', '');
    stored_revision := coalesce(to_jsonb(old)->>'updated_at', nullif(old.data->>'updatedAt', ''), '__missing__');
    if expected_revision is null then
      raise exception using
        errcode = 'P0001',
        message = 'STALE_WRITE_REJECTED: refresh the current record before saving; its database revision is missing';
    end if;
    if expected_revision = '__missing__' or stored_revision = '__missing__' then
      if expected_revision <> stored_revision then
        raise exception using errcode = 'P0001',
          message = 'STALE_WRITE_REJECTED: another device changed this record; refresh before saving';
      end if;
    elsif expected_revision::timestamptz <> stored_revision::timestamptz then
      raise exception using errcode = 'P0001',
        message = 'STALE_WRITE_REJECTED: another device changed this record; refresh before saving';
    end if;
    begin
      incoming_updated_at := nullif(new.data->>'updatedAt', '')::timestamptz;
      stored_updated_at := nullif(old.data->>'updatedAt', '')::timestamptz;
      if incoming_updated_at is not null and stored_updated_at is not null and incoming_updated_at < stored_updated_at then
        raise exception using
          errcode = 'P0001',
          message = 'STALE_WRITE_REJECTED: incoming record is older than the stored record';
      end if;
    exception when invalid_datetime_format then
      raise exception using
        errcode = 'P0001',
        message = 'INVALID_WRITE_TIMESTAMP: updatedAt must be an ISO timestamp';
    end;
  end if;
  new.data := new.data - '_expectedUpdatedAt';
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'classes', 'members', 'grades', 'offerings', 'absence_logs', 'referrals',
    'workers', 'worker_attendance', 'worker_prep_attendance', 'special_events',
    'special_event_attendance', 'lessons', 'admin_comments', 'treasury_expenditures',
    'sunday_school_years', 'sunday_school_year_archives', 'departments',
    'clock_in_config', 'worker_categories', 'enrollment_certifications'
  ] loop
    execute format('drop trigger if exists reject_obsolete_client_write on public.%I', table_name);
    execute format(
      'create trigger reject_obsolete_client_write before insert or update on public.%I for each row execute function public.reject_obsolete_client_write()',
      table_name
    );
  end loop;
end;
$$;

