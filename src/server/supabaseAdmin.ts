import 'dotenv/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Server-only client. Never import this module from browser code. */
export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured on the server.');
  }
  client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}

export function getBearerToken(header: string | undefined): string | null {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export const GOFAMINT_ROLES = [
  'SUPER_ADMIN',
  'GENERAL_SUPERINTENDENT',
  'DEPARTMENT_SUPERINTENDENT',
  'GENERAL_SECRETARY',
  'ASST_GENERAL_SECRETARY',
  'ASSISTANT_GENERAL_SECRETARY',
  'RECORD_OFFICER',
  'ENROLLMENT_OFFICER',
  'TREASURER',
  'TEACHER',
  'CLASS_SECRETARY',
  'TEACHER / CLASS_SECRETARY',
  'WORKER',
] as const;

export type GofamintRole = (typeof GOFAMINT_ROLES)[number];

export interface SupabaseProfileProvisioningInput {
  email: string;
  password: string;
  displayName?: string;
  role: GofamintRole;
  isApproved: boolean;
  classId?: string | null;
  workerId?: string | null;
  departmentId?: string | null;
  createdBy?: string | null;
  approvedBy?: string | null;
}

/**
 * Server-only provisioning boundary for the later staff-management phase.
 * This function is intentionally not exposed through a browser endpoint yet:
 * role, approval, worker, and class assignment must never be browser-owned.
 */
export async function provisionSupabaseUserProfile(input: SupabaseProfileProvisioningInput) {
  if (!GOFAMINT_ROLES.includes(input.role)) {
    throw new Error('Unsupported GOFAMINT role.');
  }
  if (!input.email || !input.password) {
    throw new Error('Email and password are required for Supabase Auth provisioning.');
  }

  const admin = getSupabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    email_confirm: true,
    user_metadata: input.displayName ? { display_name: input.displayName } : undefined,
  });
  if (authError || !authData.user) {
    throw authError || new Error('Supabase Auth did not return a created user.');
  }

  const approvedAt = input.isApproved ? new Date().toISOString() : null;
  const { error: profileError } = await admin.from('profiles').insert({
    id: authData.user.id,
    email: authData.user.email || input.email.trim().toLowerCase(),
    display_name: input.displayName || null,
    role: input.role,
    is_approved: input.isApproved,
    class_id: input.classId || null,
    worker_id: input.workerId || null,
    department_id: input.departmentId || null,
    created_by: input.createdBy || null,
    approved_by: input.isApproved ? input.approvedBy || null : null,
    approved_at: approvedAt,
  });

  if (profileError) {
    // Do not leave a credential without the required application profile.
    await admin.auth.admin.deleteUser(authData.user.id);
    throw profileError;
  }

  return { userId: authData.user.id, approvedAt };
}
