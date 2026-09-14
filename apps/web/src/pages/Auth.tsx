import React, { useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../ui.js';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { refresh } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.login(email, password);
      await refresh();
      window.location.href = '/app';
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="center">
      <div className="card">
        <div className="auth-title">Welcome back</div>
        <p className="muted">Log in to your Shrinkr workspace.</p>
        {error && <div className="error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn primary" style={{ width: '100%' }} disabled={busy} type="submit">
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 14 }}>No account? <a href="/signup">Sign up</a></p>
      </div>
    </div>
  );
}

export function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { refresh } = useAuth();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.signup(email, password, name);
      await refresh();
      window.location.href = '/app';
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="center">
      <div className="card">
        <div className="auth-title">Create your workspace</div>
        <p className="muted">Free plan: 5 links, 100 tracked clicks each. No card needed (sandbox billing).</p>
        {error && <div className="error">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password (8+ chars)</label>
            <input id="password" className="input" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn primary" style={{ width: '100%' }} disabled={busy} type="submit">
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 14 }}>Have an account? <a href="/login">Log in</a></p>
      </div>
    </div>
  );
}
