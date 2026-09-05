import 'dotenv/config';
import { getSupabaseAdmin } from '../src/server/supabaseAdmin.ts';

const PROJECT_REF = 'oroebitityxfzrdhtsvt';
const db = getSupabaseAdmin();

const TABLES = [
  'audit_logs', 'special_event_attendance', 'worker_prep_attendance',
  'worker_attendance', 'special_events', 'workers', 'clock_in_config',
  'worker_categories', 'treasury_expenditures', 'admin_comments', 'lessons',
  'referrals', 'absence_logs', 'grades', 'offerings', 'members',
  'profile_class_assignments', 'classes', 'departments',
  'sunday_school_year_archives', 'sunday_school_years', 'admin_profiles',
  'profiles', 'system_config',
] as const;

function deleteQuery(table: string) {
  const query: any = db.from(table).delete();
  return table === 'profile_class_assignments'
    ? query.not('profile_id', 'is', null)
    : query.not('id', 'is', null);
}

async function inventory() {
  const counts = Object.fromEntries(await Promise.all(TABLES.map(async (table) => {
    const { count, error } = await db.from(table).select('*', { count: 'exact', head: true });
    return [table, error ? `ERROR: ${error.message}` : count];
  })));
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1 });
  return { project: PROJECT_REF, tables: counts, authUsers: error ? `ERROR: ${error.message}` : (data as any)?.total ?? (data as any)?.users?.length ?? 0 };
}

async function reset() {
  if (!process.env.SUPABASE_URL?.includes(PROJECT_REF)) throw new Error('Refusing to reset an unexpected Supabase project.');
  if (process.env.CONFIRM_RESET_PROJECT !== PROJECT_REF) throw new Error('Set CONFIRM_RESET_PROJECT to the expected project reference to reset.');

  for (const table of TABLES) {
    const { error } = await deleteQuery(table);
    if (error) throw new Error(`Could not clear ${table}: ${error.message}`);
  }

  let page = 1;
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`Could not list Auth users: ${error.message}`);
    const users = data?.users || [];
    for (const user of users) {
      const { error: deleteError } = await db.auth.admin.deleteUser(user.id);
      if (deleteError) throw new Error(`Could not delete Auth user ${user.id}: ${deleteError.message}`);
    }
    if (users.length < 1000) break;
    page += 1;
  }
}

const mode = process.argv[2] || 'inventory';
if (mode === 'reset') {
  await reset();
  console.log(JSON.stringify({ reset: 'complete', ...(await inventory()) }));
} else {
  console.log(JSON.stringify(await inventory()));
}
