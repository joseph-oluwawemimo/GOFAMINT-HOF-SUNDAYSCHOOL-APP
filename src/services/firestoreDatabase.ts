/**
 * Legacy module name retained only as an import compatibility boundary.
 *
 * Older UI and IndexedDB code imported this path while the app used
 * Firestore. Keeping the path avoids a broad UI rewrite, but every exported
 * operation now goes to the authenticated Supabase/Postgres implementation.
 */
export { cleanForSupabase as cleanForFirestore } from './supabaseDatabase';
export * from './supabaseDatabase';
