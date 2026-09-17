import {
  User,
} from '@supabase/supabase-js';
import { getSupabaseClient } from './supabase';
import { normalizeLoginIdentifier } from '../utils/loginIdentifier';

export { normalizeLoginIdentifier } from '../utils/loginIdentifier';

/**
 * Normalizes login identifiers:
 * - If contains '@', standard email is used (e.g. pastor@example.com).
 * - If officer alias (e.g. GS, GSEC, TREASURER), mapped to their registered email.
 * - If class identifier (e.g. YOUTHA, AdultBibleA), translated internally to
 *   class_youtha@gofamint-hof.internal so teachers/secretaries do not need personal Gmails.
 */
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
