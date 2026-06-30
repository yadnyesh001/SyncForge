/**
 * pages/Login.jsx — email/password sign-in.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your documents">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Email" type="email" value={email} onChange={setEmail} autoFocus placeholder="you@example.com" />
        <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
        <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-[15px]">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        No account?{' '}
        <Link to="/register" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}

/* ---- Shared presentational helpers for Login + Register ---- */

export function AuthShell({ title, subtitle, children }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 dark:bg-slate-950">
      {/* Ambient gradient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-violet-500/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 text-2xl font-bold text-white shadow-lift">
            S
          </div>
          <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-2xl font-bold text-transparent dark:from-white dark:to-slate-400">
            {title}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>

        <div className="card p-8 backdrop-blur">{children}</div>

        <p className="mt-6 text-center text-xs text-slate-400">
          SyncForge · real-time collaborative editing
        </p>
      </div>
    </div>
  );
}

export function Field({ label, type = 'text', value, onChange, autoFocus, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        required
        className="input"
      />
    </label>
  );
}

export function Alert({ children }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 animate-scale-in dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300">
      <span className="mt-0.5">⚠️</span>
      <span>{children}</span>
    </div>
  );
}
