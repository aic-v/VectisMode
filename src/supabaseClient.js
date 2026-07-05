// The one Supabase client, shared by the data layer (remote.js) and the auth
// layer (auth.js). Entirely env-gated: without VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY it is null and the app runs local-only (localStorage),
// which is also what every test environment uses.
//
// Unlike the pre-auth data-only client, this one persists the session and
// reads the OAuth redirect back from the URL, so a Google sign-in survives a
// page reload.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env?.VITE_SUPABASE_URL;
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

export const remoteEnabled = Boolean(url && anonKey);

export const supabase = remoteEnabled
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
