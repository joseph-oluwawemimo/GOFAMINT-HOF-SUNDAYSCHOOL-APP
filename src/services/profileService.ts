import { getSupabaseClient } from './supabase';

export type GofamintRole =
  | 'SUPER_ADMIN'
  | 'GENERAL_SUPERINTENDENT'
  | 'DEPARTMENT_SUPERINTENDENT'
  | 'GENERAL_SECRETARY'
  | 'ASST_GENERAL_SECRETARY'
  | 'ASSISTANT_GENERAL_SECRETARY'
  | 'RECORD_OFFICER'
  | 'ENROLLMENT_OFFICER'
  | 'TREASURER'
  | 'TEACHER'
  | 'CLASS_SECRETARY'
  | 'TEACHER / CLASS_SECRETARY'
  | 'WORKER';

export interface ApplicationProfile {
  id: string;
  email: string;
  displayName: string | null;
  role: GofamintRole;
  isApproved: boolean;
  classId: string | null;
  workerId: string | null;
  departmentId: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

/**
 * Reads only the signed-in user's application profile. RLS remains the
 * authority for this query; no client profile writes are exposed here.
 */
export async function loadCurrentProfile(userId: string): Promise<ApplicationProfile | null> {
  const client = getSupabaseClient();
  let { data, error } = await client
    .from('profiles')
    .select('id, email, display_name, role, is_approved, class_id, worker_id, department_id, approved_by, approved_at, created_at')
    .eq('id', userId)
    .maybeSingle();

  // Rolling deployments must keep existing officers operational while the
  // additive department migration is being applied.
  if (error && /department_id/i.test(error.message || '')) {
    const fallback = await client
      .from('profiles')
      .select('id, email, display_name, role, is_approved, class_id, worker_id, approved_by, approved_at, created_at')
      .eq('id', userId)
      .maybeSingle();
    data = fallback.data ? { ...fallback.data, department_id: null } as any : null;
    error = fallback.error;
  }

  if (error) throw error;

  // Fallback: If not found by UUID, try finding by auth user's email
  if (!data) {
    try {
      const { data: authUser } = await client.auth.getUser();
      if (authUser?.user?.email) {
        let { data: byEmail, error: emailLookupError } = await client
          .from('profiles')
          .select('id, email, display_name, role, is_approved, class_id, worker_id, department_id, approved_by, approved_at, created_at')
          .eq('email', authUser.user.email.toLowerCase())
          .maybeSingle();
        if (emailLookupError && /department_id/i.test(emailLookupError.message || '')) {
          const fallback = await client.from('profiles')
            .select('id, email, display_name, role, is_approved, class_id, worker_id, approved_by, approved_at, created_at')
            .eq('email', authUser.user.email.toLowerCase()).maybeSingle();
          byEmail = fallback.data ? { ...fallback.data, department_id: null } as any : null;
          emailLookupError = fallback.error;
        }
        if (emailLookupError) throw emailLookupError;
        if (byEmail) data = byEmail;
      }
    } catch (fallbackError) {
      console.error('Profile email fallback lookup failed:', fallbackError);
      throw fallbackError;
    }
  }

  if (!data) return null;

  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    role: data.role as GofamintRole,
    isApproved: data.is_approved === true,
    classId: data.class_id,
    workerId: data.worker_id,
    departmentId: data.department_id,
    approvedBy: data.approved_by,
    approvedAt: data.approved_at,
    createdAt: data.created_at,
  };
}
