import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '../src/server/supabaseAdmin.ts';

const db = getSupabaseAdmin();
const anonClient = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function test() {
  const userId = '3ac10ce4-77f0-4291-99bc-656a0ec0eb3a';
  
  // 1. Check profile with admin client
  const { data: adminProf, error: adminErr } = await db
    .from('profiles')
    .select('id, email, display_name, role, is_approved, class_id, worker_id, approved_by, approved_at, created_at')
    .eq('id', userId)
    .maybeSingle();
  console.log('Admin client profile query:', { data: adminProf, error: adminErr });

  // 2. Can anon client read profiles without a session? (should be blocked by RLS)
  const { data: anonProf, error: anonErr } = await anonClient
    .from('profiles')
    .select('id, email, display_name, role, is_approved, class_id, worker_id, approved_by, approved_at, created_at')
    .eq('id', userId)
    .maybeSingle();
  console.log('Anon client without session profile query:', { data: anonProf, error: anonErr });
}

test();
