// Google Workspace SSO via Supabase Auth. Like remote.js this is entirely
// env-gated: with no VITE_SUPABASE_* the app runs local-only and `authEnabled`
// is false, so offline development and the test suite never see a login gate.
//
// Identity is resolved from the `members` table (see
// supabase/migrations/0002_auth.sql), which is the single source of truth for
// which email owns which board slot and who is the manager. RLS returns only
// rows the caller may see, so a plain select of the member table is safe.

import { supabase, remoteEnabled } from './supabaseClient.js';

export const authEnabled = remoteEnabled;

// Kick off the Google OAuth flow. `hd` hints the Google account chooser toward
// the firm domain; the real domain restriction is enforced by the "Internal"
// OAuth consent screen and by the members roster in RLS — never trust `hd`
// alone. Returns any error so the caller can surface it.
export async function signInWithGoogle() {
  if (!supabase) return { error: new Error('Auth is not configured') };
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: { hd: 'vectis.law', prompt: 'select_account' },
    },
  });
  return { error };
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

export function onAuthChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session ?? null);
  });
  return () => data.subscription.unsubscribe();
}

// Resolve the signed-in user's member row. RLS scopes `members` to the
// caller's own row (plus the full roster for a manager), so `.maybeSingle()`
// on a self-scoped select would break for managers — filter by the session
// email explicitly instead.
export async function fetchMember(session) {
  if (!supabase || !session?.user?.email) return null;
  const email = session.user.email.toLowerCase();
  const { data, error } = await supabase
    .from('members')
    .select('id, name, role')
    .ilike('email', email)
    .maybeSingle();
  if (error || !data) return null;
  return { memberId: data.id, name: data.name, role: data.role, email };
}

// The roster a manager can view-as. Non-managers only ever get their own row
// back from RLS, so this doubles as a no-op for them.
export async function fetchRoster() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('members')
    .select('id, name, role')
    .order('id');
  if (error || !data) return [];
  return data.map((row) => ({ id: row.id, name: row.name, role: row.role }));
}
