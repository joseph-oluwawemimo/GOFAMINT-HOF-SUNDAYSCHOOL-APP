import { getSupabaseClient } from './supabase';

export type GofamintRole =
  | 'SUPER_ADMIN'
  | 'GENERAL_SUPERINTENDENT'
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
    .select('id, email, display_name, role, is_approved, class_id, worker_id, approved_by, approved_at, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  // Fallback: If not found by UUID, try finding by auth user's email
  if (!data) {
    try {
      const { data: authUser } = await client.auth.getUser();
      if (authUser?.user?.email) {
        const { data: byEmail } = await client
          .from('profiles')
          .select('id, email, display_name, role, is_approved, class_id, worker_id, approved_by, approved_at, created_at')
          .eq('email', authUser.user.email.toLowerCase())
          .maybeSingle();
        if (byEmail) data = byEmail;
      }
    } catch {}
  }

  if (!data) return null;

  let isApproved = data.is_approved === true;
  let approvedBy = data.approved_by;
  let approvedAt = data.approved_at;

  // If profiles record is not yet marked approved, also check admin_profiles table
  if (!isApproved) {
    try {
      const { data: adminRow } = await client
        .from('admin_profiles')
        .select('is_approved, approved_by, approved_at')
        .or(`id.eq.${userId},profile_id.eq.${userId},username.eq.${data.email}`)
        .maybeSingle();

      if (adminRow && adminRow.is_approved === true) {
        isApproved = true;
        approvedBy = adminRow.approved_by || approvedBy;
        approvedAt = adminRow.approved_at || approvedAt;
      }
    } catch {}
  }

  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    role: data.role as GofamintRole,
    isApproved,
    classId: data.class_id,
    workerId: data.worker_id,
    approvedBy,
    approvedAt,
    createdAt: data.created_at,
  };
}
