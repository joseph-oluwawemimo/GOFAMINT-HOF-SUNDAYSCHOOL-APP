-- Non-destructive, atomic SSS report completion persistence.
-- This function changes only classes.data.sssrDeliveries and updatedAt.
create or replace function public.merge_timestamped_record_maps(
  p_stored jsonb, p_incoming jsonb
) returns jsonb
language plpgsql
immutable
set search_path = public
as $$
declare
  result jsonb := coalesce(p_stored, '{}'::jsonb);
  record_key text;
  record_value jsonb;
begin
  if jsonb_typeof(result) <> 'object' or jsonb_typeof(coalesce(p_incoming, '{}'::jsonb)) <> 'object' then
    raise exception 'Operational record maps must be JSON objects';
  end if;
  for record_key, record_value in select * from jsonb_each(coalesce(p_incoming, '{}'::jsonb)) loop
    if jsonb_typeof(record_value) <> 'object' then
      raise exception 'Operational record % must be a JSON object', record_key;
    end if;
    if result->record_key is null or
      coalesce(nullif(record_value->>'updatedAt', '')::timestamptz, '-infinity'::timestamptz)
        >= coalesce(nullif(result->record_key->>'updatedAt', '')::timestamptz, '-infinity'::timestamptz) then
      result := jsonb_set(result, array[record_key], record_value, true);
    end if;
  end loop;
  return result;
end;
$$;

create or replace function public.merge_class_sssr_deliveries(
  p_class_id text,
  p_deliveries jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  merged jsonb;
  delivery jsonb;
begin
  if p_class_id is null or btrim(p_class_id) = '' then
    raise exception 'Class id is required';
  end if;
  if p_deliveries is null or jsonb_typeof(p_deliveries) <> 'object' then
    raise exception 'Deliveries must be a JSON object';
  end if;
  for delivery in select value from jsonb_each(p_deliveries) loop
    if not exists (
      select 1 from public.members
      where id = delivery->>'memberId'
        and (class_id = p_class_id or data->>'classId' = p_class_id)
    ) then
      raise exception 'SSS delivery member does not belong to the requested class';
    end if;
  end loop;

  update public.classes
     set data = jsonb_set(
       jsonb_set(
         coalesce(data, '{}'::jsonb),
         '{sssrDeliveries}',
         public.merge_timestamped_record_maps(data->'sssrDeliveries', p_deliveries),
         true
       ),
       '{updatedAt}',
       to_jsonb(now()::text),
       true
     ),
     updated_at = now()
   where id = p_class_id
   returning data->'sssrDeliveries' into merged;

  if merged is null then
    raise exception 'Class % was not found', p_class_id;
  end if;
  return merged;
end;
$$;

revoke all on function public.merge_class_sssr_deliveries(text, jsonb) from public, anon, authenticated;
grant execute on function public.merge_class_sssr_deliveries(text, jsonb) to service_role;

-- All class writers, including server administrative saves, retain newer report
-- completions and visitation records that were saved by another device.
create or replace function public.preserve_class_operational_records()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  field_name text;
begin
  foreach field_name in array array['sssrDeliveries', 'visitationAssignments'] loop
    if old.data->field_name is not null or new.data->field_name is not null then
      new.data := jsonb_set(new.data, array[field_name],
        public.merge_timestamped_record_maps(old.data->field_name, new.data->field_name), true);
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists preserve_class_operational_records on public.classes;
create trigger preserve_class_operational_records before update on public.classes
for each row execute function public.preserve_class_operational_records();

-- The public profile form can change only personal profile fields. Locking the
-- latest row prevents registration from overwriting concurrent staff changes.
create or replace function public.complete_member_public_profile(
  p_member_id text, p_public_token text, p_profile jsonb, p_report_card_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member_data jsonb;
  profile_token text;
  report_token text;
  profile_fields jsonb;
  current_time_text text := to_char(clock_timestamp() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
begin
  select data into member_data from public.members where id = p_member_id for update;
  if member_data is null then raise exception 'Student was not found'; end if;
  profile_token := case when jsonb_typeof(member_data->'oneTimeProfileToken') = 'string'
    then member_data->>'oneTimeProfileToken' else member_data->'oneTimeProfileToken'->>'token' end;
  report_token := case when jsonb_typeof(member_data->'reportCardToken') = 'string'
    then member_data->>'reportCardToken' else member_data->'reportCardToken'->>'token' end;
  if p_public_token is null or p_public_token = ''
    or (p_public_token is distinct from profile_token and p_public_token is distinct from report_token) then
    raise exception 'Invalid student profile link';
  end if;
  if coalesce((member_data->>'isProfileCompleted')::boolean, false)
    or coalesce((member_data->'oneTimeProfileToken'->>'isUsed')::boolean, false) then
    return jsonb_build_object('reportCardToken', coalesce(report_token, p_public_token));
  end if;
  if p_report_card_token is null or length(p_report_card_token) < 32 then
    raise exception 'A secure report card token is required';
  end if;
  if jsonb_typeof(p_profile) <> 'object' then raise exception 'Profile must be a JSON object'; end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into profile_fields
    from jsonb_each(p_profile) where key = any(array[
      'fullName', 'phone', 'address', 'occupation', 'gender', 'ageGroup', 'prayerRequests', 'photoBase64'
    ]);
  report_token := coalesce(nullif(report_token, ''), p_report_card_token);
  member_data := member_data || profile_fields || jsonb_build_object(
    'isProfileCompleted', true, 'updatedAt', current_time_text,
    'reportCardToken', case when member_data->'reportCardToken'->>'token' = report_token
      or member_data->>'reportCardToken' = report_token then member_data->'reportCardToken'
      else jsonb_build_object('token', report_token, 'createdAt', current_time_text) end
  );
  if profile_token is not null then
    member_data := member_data || jsonb_build_object('oneTimeProfileToken',
      case when jsonb_typeof(member_data->'oneTimeProfileToken') = 'object'
        then member_data->'oneTimeProfileToken' else jsonb_build_object('token', profile_token) end
      || jsonb_build_object('isUsed', true, 'usedAt', current_time_text));
  end if;
  update public.members set data = member_data, updated_at = clock_timestamp() where id = p_member_id;
  return jsonb_build_object('reportCardToken', report_token);
end;
$$;
revoke all on function public.complete_member_public_profile(text, text, jsonb, text) from public, anon, authenticated;
grant execute on function public.complete_member_public_profile(text, text, jsonb, text) to service_role;

create or replace function public.ensure_class_member_public_links(
  p_class_id text, p_proposed_tokens jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member_id text;
  proposed_token text;
  member_data jsonb;
  link_token text;
  links jsonb := '{}'::jsonb;
begin
  if jsonb_typeof(p_proposed_tokens) <> 'object' then raise exception 'Member tokens must be a JSON object'; end if;
  for member_id, proposed_token in select * from jsonb_each_text(p_proposed_tokens) order by key loop
    select data into member_data from public.members
      where id = member_id and (class_id = p_class_id or data->>'classId' = p_class_id) for update;
    if member_data is null then raise exception 'Student % does not belong to class %', member_id, p_class_id; end if;
    link_token := coalesce(
      case when jsonb_typeof(member_data->'oneTimeProfileToken') = 'string'
        then nullif(member_data->>'oneTimeProfileToken', '') else nullif(member_data->'oneTimeProfileToken'->>'token', '') end,
      case when jsonb_typeof(member_data->'reportCardToken') = 'string'
        then nullif(member_data->>'reportCardToken', '') else nullif(member_data->'reportCardToken'->>'token', '') end
    );
    if link_token is null then
      if proposed_token is null or length(proposed_token) < 32 then raise exception 'A secure profile token is required'; end if;
      link_token := proposed_token;
      update public.members set
        data = jsonb_set(data, '{oneTimeProfileToken}', jsonb_build_object('token', link_token, 'isUsed', false, 'createdAt', now()), true),
        updated_at = clock_timestamp()
      where id = member_id;
    end if;
    links := links || jsonb_build_object(member_id, jsonb_build_object('token', link_token));
  end loop;
  return links;
end;
$$;
revoke all on function public.ensure_class_member_public_links(text, jsonb) from public, anon, authenticated;
grant execute on function public.ensure_class_member_public_links(text, jsonb) to service_role;

