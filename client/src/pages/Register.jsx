/**
 * pages/Register.jsx — create an account.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthShell, Field, Alert } from './Login';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(name, email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Start collaborating in real time">
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Name" value={name} onChange={setName} autoFocus placeholder="Ada Lovelace" />
        <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
        <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="At least 6 characters" />
        <button type="submit" disabled={busy} className="btn-primary w-full py-3 text-[15px]">
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
