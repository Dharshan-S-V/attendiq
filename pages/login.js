// pages/login.js
import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Login() {
  const router = useRouter();
  const [mode, setMode]       = useState('login');
  const [form, setForm]       = useState({ username:'', password:'', college:'' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState('');

  const upd = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Something went wrong'); return; }
      router.push('/admin');
    } catch { setError('Network error. Try again.'); }
    finally { setLoading(false); }
  }

  return (
    <>
      <Head><title>AttendIQ — {mode === 'login' ? 'Sign In' : 'Create Account'}</title></Head>
      <div style={S.page}>

        {/* Background gradient mesh */}
        <div style={S.bgMesh} />

        <div style={S.card}>
          {/* Logo */}
          <div style={S.logoWrap}>
            <div style={S.logoIcon}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="8" fill="#0071e3"/>
                <path d="M7 14h14M14 7l7 7-7 7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={S.logoText}>AttendIQ</span>
          </div>

          <h1 style={S.title}>
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </h1>
          <p style={S.subtitle}>
            {mode === 'login'
              ? 'Manage attendance sessions and track students'
              : 'Start managing attendance with GPS verification'}
          </p>

          <form onSubmit={submit} style={{ marginTop: '28px' }}>
            <Field label="Username" focused={focused === 'username'}>
              <input
                style={S.input}
                value={form.username}
                onChange={upd('username')}
                onFocus={() => setFocused('username')}
                onBlur={() => setFocused('')}
                placeholder="Enter your username"
                required autoFocus
              />
            </Field>

            <Field label="Password" focused={focused === 'password'}>
              <input
                style={S.input}
                type="password"
                value={form.password}
                onChange={upd('password')}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused('')}
                placeholder="Min 6 characters"
                required
              />
            </Field>

            {mode === 'register' && (
              <Field label="College Name" focused={focused === 'college'}>
                <input
                  style={S.input}
                  value={form.college}
                  onChange={upd('college')}
                  onFocus={() => setFocused('college')}
                  onBlur={() => setFocused('')}
                  placeholder="e.g. Anna University"
                />
              </Field>
            )}

            {error && (
              <div style={S.errorBox}>
                <span style={{ fontSize:'16px' }}>⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button type="submit" style={S.submitBtn} disabled={loading}>
              {loading
                ? <div style={S.btnSpinner}/>
                : mode === 'login' ? 'Sign In' : 'Create Account'
              }
            </button>
          </form>

          <div style={S.switchRow}>
            <span style={{ color: 'var(--txt3)', fontSize:'14px' }}>
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            </span>
            <button
              style={S.switchBtn}
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            >
              {mode === 'login' ? 'Register' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, focused, children }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{
        display: 'block', fontSize: '13px', fontWeight: 500,
        color: focused ? 'var(--acc)' : 'var(--txt3)',
        marginBottom: '7px', transition: 'color .2s',
        letterSpacing: '-0.1px'
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px', position: 'relative', overflow: 'hidden',
  },
  bgMesh: {
    position: 'fixed', inset: 0, zIndex: 0,
    background: 'radial-gradient(ellipse 80% 60% at 20% 20%, rgba(0,113,227,0.06) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 80% 80%, rgba(52,199,89,0.04) 0%, transparent 60%), linear-gradient(180deg, #f5f5f7 0%, #ffffff 100%)',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative', zIndex: 1,
    background: 'rgba(255,255,255,0.85)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-xl)',
    padding: '40px 40px 36px',
    width: '100%', maxWidth: '420px',
    boxShadow: 'var(--shadow-xl)',
    animation: 'scaleIn .4s cubic-bezier(0.34,1.56,0.64,1)',
  },
  logoWrap: {
    display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px',
  },
  logoIcon: {
    borderRadius: '10px', overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,113,227,0.25)',
  },
  logoText: {
    fontSize: '18px', fontWeight: 600, color: 'var(--txt)', letterSpacing: '-0.3px',
  },
  title: {
    fontSize: '22px', fontWeight: 700, color: 'var(--txt)',
    letterSpacing: '-0.5px', lineHeight: '1.2', marginBottom: '6px',
  },
  subtitle: {
    fontSize: '14px', color: 'var(--txt3)', lineHeight: '1.5',
  },
  input: {
    width: '100%', padding: '11px 14px',
    background: 'var(--surface2)',
    border: '1.5px solid var(--border2)',
    borderRadius: '10px',
    fontSize: '15px', color: 'var(--txt)',
    outline: 'none', transition: 'all .2s',
  },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: '8px',
    background: 'var(--red-bg)',
    border: '1px solid rgba(255,59,48,0.2)',
    borderRadius: '10px', padding: '11px 14px',
    color: 'var(--red)', fontSize: '13px',
    fontWeight: 500, marginBottom: '16px',
  },
  submitBtn: {
    width: '100%', padding: '13px',
    background: 'var(--acc)', color: '#fff',
    border: 'none', borderRadius: '10px',
    fontSize: '15px', fontWeight: 600,
    cursor: 'pointer', transition: 'all .2s',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 12px rgba(0,113,227,0.3)',
    letterSpacing: '-0.2px',
  },
  btnSpinner: {
    width: '18px', height: '18px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff', borderRadius: '50%',
    animation: 'spin .6s linear infinite',
  },
  switchRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '6px', marginTop: '24px',
  },
  switchBtn: {
    background: 'none', border: 'none', color: 'var(--acc)',
    fontSize: '14px', fontWeight: 600, cursor: 'pointer', padding: '0',
    letterSpacing: '-0.1px',
  },
};
