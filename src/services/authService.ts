import {
  User,
} from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';

const ROLE_ALIASES: Record<string, string> = {
  // General Superintendent / Super Admin
  gs: 'gofaminthouseoffavour@gmail.com',
  superintendent: 'gofaminthouseoffavour@gmail.com',
  generalsuperintendent: 'gofaminthouseoffavour@gmail.com',
  pastorolayemi: 'gofaminthouseoffavour@gmail.com',
  olanegan: 'gofaminthouseoffavour@gmail.com',
  superadmin: 'gofaminthouseoffavour@gmail.com',
  admin: 'gofaminthouseoffavour@gmail.com',

  // General Secretary
  gsec: 'odedeyioluwaseun86@gmail.com',
  generalsecretary: 'odedeyioluwaseun86@gmail.com',
  secretary: 'odedeyioluwaseun86@gmail.com',
  pastorodedeyi: 'odedeyioluwaseun86@gmail.com',
  odedeyi: 'odedeyioluwaseun86@gmail.com',

  // Assistant General Secretary
  asstgsec: 'daisi@gmail.com',
  asstsec: 'daisi@gmail.com',
  asstgeneralsecretary: 'daisi@gmail.com',
  assistantgeneralsecretary: 'daisi@gmail.com',
  assistantsecretary: 'daisi@gmail.com',
  daisi: 'daisi@gmail.com',

  // Record Officer
  recordofficer: 'nike@gmail.com',
  record: 'nike@gmail.com',
  records: 'nike@gmail.com',
  nike: 'nike@gmail.com',

  // Enrollment Officer
  enrollmentofficer: 'favour@gmail.com',
  enrollment: 'favour@gmail.com',
  favour: 'favour@gmail.com',

  // Treasurer
  treasurer: 'oriola@gmail.com',
  treasury: 'oriola@gmail.com',
  finance: 'oriola@gmail.com',
  oriola: 'oriola@gmail.com',

  // Class aliases (with or without underscores/spaces)
  adulta: 'class_adult_a@gofamint-hof.internal',
  adultclassa: 'class_adult_a@gofamint-hof.internal',
  youtha: 'class_youth_a@gofamint-hof.internal',
  youthclassa: 'class_youth_a@gofamint-hof.internal',
  intermediatea: 'class_intermediate_a@gofamint-hof.internal',
  intermediateclassa: 'class_intermediate_a@gofamint-hof.internal',
};

/**
 * Normalizes login identifiers:
 * - If contains '@', standard email is used (e.g. pastor@example.com).
 * - If officer alias (e.g. GS, GSEC, TREASURER), mapped to their registered email.
 * - If class identifier (e.g. YOUTHA, AdultBibleA), translated internally to
 *   class_youtha@gofamint-hof.internal so teachers/secretaries do not need personal Gmails.
 */
export function normalizeLoginIdentifier(rawIdentifier: string): string {
  const trimmed = String(rawIdentifier || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  const cleanId = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (ROLE_ALIASES[cleanId]) {
    return ROLE_ALIASES[cleanId];
  }
  if (cleanId.startsWith('class')) {
    return `${cleanId}@gofamint-hof.internal`;
  }
  return `class_${cleanId}@gofamint-hof.internal`;
}

export function watchAuthState(callback: (user: User | null) => void) {
  const { data } = getSupabaseClient().auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}

export async function signIn(identifier: string, password: string): Promise<User> {
  const normalizedEmail = normalizeLoginIdentifier(identifier);
  const { data, error } = await getSupabaseClient().auth.signInWithPassword({
    email: normalizedEmail,
    password,
  });
  if (error) throw error;
  if (!data.user) throw new Error('Supabase did not return a signed-in user.');
  return data.user;
}

/**
 * Re-authenticates the currently logged-in user with their password
 * for unlocking a locked profile session without signing out.
 */
export async function reauthenticateUser(password: string): Promise<boolean> {
  const client = getSupabaseClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user?.email) {
    return false;
  }
  try {
    const { error } = await client.auth.signInWithPassword({ email: user.email, password });
    if (error) return false;
    return true;
  } catch (err) {
    console.warn('Re-authentication failed:', err);
    return false;
  }
}

export async function signOutUser(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}

/** Returns the current Supabase access token for future migrated server APIs. */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.access_token ?? null;
}

/** Returns the currently active session user if already authenticated in browser storage. */
export async function getCurrentUser(): Promise<User | null> {
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.user ?? null;
}
