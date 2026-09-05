import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './src/server/supabaseAdmin.ts';

async function verifyApprovalFlow() {
  console.log('--- Starting End-to-End Approval Verification ---');
  const url = process.env.SUPABASE_URL!;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
  const client = createClient(url, anonKey);

  // 1. Verify General Secretary approval
  console.log('\n[1] Testing General Secretary approval (Intermediate Class A)...');
  const { data: gsecAuth, error: gsecErr } = await client.auth.signInWithPassword({
    email: 'odedeyioluwaseun86@gmail.com',
    password: 'Password123!'
  });
  if (gsecErr || !gsecAuth.session) throw new Error('GSEC login failed: ' + gsecErr?.message);

  const res1 = await fetch('http://localhost:3000/api/admin/classes/approve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${gsecAuth.session.access_token}`
    },
    body: JSON.stringify({ classId: 'INTERMEDIATE_A' })
  });
  const data1 = await res1.json();
  console.log('GSEC Approve response:', data1);
  if (!data1.success || data1.class?.approvalStatus !== 'APPROVED') {
    throw new Error('GSEC approval failed');
  }

  // 2. Verify General Superintendent approval
  console.log('\n[2] Testing General Superintendent approval (Youth Class A)...');
  const { data: gsAuth, error: gsErr } = await client.auth.signInWithPassword({
    email: 'gofaminthouseoffavour@gmail.com',
    password: 'Password123!'
  });
  if (gsErr || !gsAuth.session) throw new Error('GS login failed: ' + gsErr?.message);

  const res2 = await fetch('http://localhost:3000/api/admin/classes/approve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${gsAuth.session.access_token}`
    },
    body: JSON.stringify({ classId: 'YOUTH_A' })
  });
  const data2 = await res2.json();
  console.log('GS Approve response:', data2);
  if (!data2.success || data2.class?.approvalStatus !== 'APPROVED') {
    throw new Error('GS approval failed');
  }

  // 3. Verify GET /api/admin/classes reflects approved statuses
  console.log('\n[3] Testing GET /api/admin/classes reflects approvals...');
  const res3 = await fetch('http://localhost:3000/api/admin/classes', {
    headers: { 'Authorization': `Bearer ${gsAuth.session.access_token}` }
  });
  const listData = await res3.json();
  console.log('Total classes returned from API:', listData.classes?.length);

  const intermediateA = listData.classes?.find((c: any) => c.id === 'INTERMEDIATE_A');
  const youthA = listData.classes?.find((c: any) => c.id === 'YOUTH_A');
  console.log('INTERMEDIATE_A status:', intermediateA?.approvalStatus);
  console.log('YOUTH_A status:', youthA?.approvalStatus);

  if (intermediateA?.approvalStatus !== 'APPROVED' || youthA?.approvalStatus !== 'APPROVED') {
    throw new Error('Class listing did not reflect APPROVED status!');
  }

  // 4. Verify Supabase classes table directly
  console.log('\n[4] Directly verifying Supabase classes table...');
  const admin = getSupabaseAdmin();
  const { data: dbRows, error: dbErr } = await admin.from('classes').select('id, department_id, data').in('id', ['INTERMEDIATE_A', 'YOUTH_A']);
  if (dbErr) throw dbErr;

  for (const r of dbRows || []) {
    console.log(`Database row [${r.id}]: department=${r.department_id}, approvalStatus=${r.data?.approvalStatus}, approvedBy=${r.data?.approvedBy}`);
    if (r.data?.approvalStatus !== 'APPROVED') {
      throw new Error(`Row ${r.id} is not APPROVED in database!`);
    }
  }

  console.log('\n--- ALL APPROVAL FLOW CHECKS PASSED SUCCESSFULLY ---');
}

verifyApprovalFlow().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
