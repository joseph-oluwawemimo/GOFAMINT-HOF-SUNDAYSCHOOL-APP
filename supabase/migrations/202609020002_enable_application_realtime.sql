-- Prompt 3: publish only the tables the browser currently subscribes to.
-- RLS remains enabled and continues to control which row changes each
-- authenticated Supabase client receives; this migration adds no policies.
do $$
declare
  application_table text;
begin
  foreach application_table in array array[
    'sunday_school_years',
    'classes',
    'members',
    'grades',
    'offerings',
    'absence_logs',
    'admin_comments',
    'treasury_expenditures',
    'workers',
    'worker_attendance',
    'worker_prep_attendance',
    'worker_categories',
    'special_events',
    'admin_profiles'
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
