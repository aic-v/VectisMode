import { useEffect, useState } from 'react';
import {
  authEnabled,
  fetchMember,
  fetchRoster,
  getSession,
  onAuthChange,
  signInWithGoogle,
  signOut,
} from './auth.js';

// Drives the login gate. Status progression:
//   'disabled'  — no Supabase env; the app runs local-only, no gate.
//   'loading'   — resolving the session / member on startup.
//   'signed-out'— no session; show the sign-in screen.
//   'unknown'   — signed in with Google, but the email isn't in the roster.
//   'signed-in' — session + a resolved member; `member` is populated.
//
// `member` is { memberId, name, role, email }. `roster` is the list a manager
// may view-as (just their own row for non-managers).
export default function useAuth() {
  const [status, setStatus] = useState(authEnabled ? 'loading' : 'disabled');
  const [member, setMember] = useState(null);
  const [roster, setRoster] = useState([]);

  useEffect(() => {
    if (!authEnabled) return undefined;
    let cancelled = false;

    async function resolve(session) {
      if (!session) {
        if (!cancelled) {
          setMember(null);
          setRoster([]);
          setStatus('signed-out');
        }
        return;
      }
      const resolved = await fetchMember(session);
      if (cancelled) return;
      if (!resolved) {
        setMember({ email: session.user?.email ?? null });
        setStatus('unknown');
        return;
      }
      setMember(resolved);
      setStatus('signed-in');
      const list = await fetchRoster();
      if (!cancelled) setRoster(list.length ? list : [{ id: resolved.memberId, name: resolved.name, role: resolved.role }]);
    }

    getSession().then(resolve);
    const unsubscribe = onAuthChange(resolve);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { status, member, roster, signIn: signInWithGoogle, signOut };
}
