-- Complete the publication used by the browser's active subscriptions.
-- Adding a table to the publication does not bypass RLS; clients still only
-- receive changes they are permitted to read.
do $$
declare
  application_table text;
begin
  foreach application_table in array array[
    'departments',
    'lessons',
    'clock_in_config',
    'special_event_attendance'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = application_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', application_table);
    end if;
  end loop;
end $$;

-- Class creation is the Assistant General Secretary's responsibility. Keep
-- updates to an existing assigned class available, but prevent every other
-- role (including the General Superintendent oversight UI) from inserting a
-- new class directly through the browser client.
drop policy if exists classes_create on public.classes;
create policy classes_create on public.classes
  for insert
  with check (
    public.current_role() in (
      'ASST_GENERAL_SECRETARY'::public.gofamint_role,
      'ASSISTANT_GENERAL_SECRETARY'::public.gofamint_role
    )
  );
