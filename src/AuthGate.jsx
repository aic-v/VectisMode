import { LogIn, LogOut, ShieldAlert, Loader } from 'lucide-react';

// The screens shown before the board when Supabase Auth is configured. Kept
// out of App.jsx so the main component stays focused on the board itself.

export function AuthLoading() {
  return (
    <div className="auth-gate" role="status" aria-live="polite">
      <div className="auth-card">
        <Loader className="auth-spinner" size={28} aria-hidden="true" />
        <p>Checking your sign-in…</p>
      </div>
    </div>
  );
}

export function SignIn({ onSignIn, error }) {
  return (
    <div className="auth-gate">
      <div className="auth-card">
        <h1>Vectis Law Command Center</h1>
        <p className="auth-lead">Sign in with your Vectis Workspace account.</p>
        <button type="button" className="auth-google" onClick={onSignIn}>
          <LogIn size={16} aria-hidden="true" />
          <span>Sign in with Google</span>
        </button>
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
      </div>
    </div>
  );
}

export function NotAuthorized({ email, onSignOut }) {
  return (
    <div className="auth-gate">
      <div className="auth-card">
        <ShieldAlert className="auth-warn-icon" size={28} aria-hidden="true" />
        <h1>No access</h1>
        <p className="auth-lead">
          {email ? <strong>{email}</strong> : 'That account'} isn&rsquo;t on the Vectis
          roster. Ask the Founder to add you, then sign in again.
        </p>
        <button type="button" className="auth-google auth-secondary" onClick={onSignOut}>
          <LogOut size={16} aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}
