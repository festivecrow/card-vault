import { useState } from 'react';
import { supabase } from '../supabase';

export default function Login() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    setMsg('');
    const fn = mode === 'signin' ? supabase.auth.signInWithPassword : supabase.auth.signUp;
    const { data, error } = await fn.call(supabase.auth, { email, password });
    setBusy(false);
    if (error) return setErr(error.message);
    if (mode === 'signup' && !data.session) {
      setMsg('Account created. Check your email for a confirmation link, then sign in.');
      setMode('signin');
    }
  }

  return (
    <div className="center-screen">
      <form className="panel narrow login" onSubmit={submit}>
        <div className="brand big">
          <span className="brand-mark" aria-hidden="true" />
          <span>Card Vault</span>
        </div>
        <p className="muted">Your cards, slabs and sealed wax, priced every night.</p>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </label>
        {err && <div className="alert">{err}</div>}
        {msg && <div className="note">{msg}</div>}
        <button className="btn primary full" disabled={busy}>
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        <button
          type="button"
          className="btn ghost full"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'First time? Create your account' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
