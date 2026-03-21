// pages/login.js
import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Login() {
  const router = useRouter();
  const [mode, setMode]     = useState('login'); // 'login' | 'register'
  const [form, setForm]     = useState({ username: '', password: '', college: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const update = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || 'Something went wrong'); return; }
      router.push('/admin');
    } catch { setError('Network error. Try again.'); }
    finally { setLoading(false); }
  }

  return (
    <>
      <Head>
        <title>AttendIQ — {mode === 'login' ? 'Login' : 'Register'}</title>
      </Head>
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.logo}>
            <div style={styles.dot} />
            AttendIQ
          </div>
          <h1 style={styles.title}>{mode === 'login' ? 'Admin Login' : 'Create Account'}</h1>
          <p style={styles.sub}>{mode === 'login' ? 'Sign in to manage attendance sessions' : 'Register as a faculty admin'}</p>

          <form onSubmit={submit}>
            <div style={styles.fg}>
              <label style={styles.label}>Username</label>
              <input style={styles.input} value={form.username} onChange={update('username')}
                placeholder="Enter username" required autoFocus />
            </div>
            <div style={styles.fg}>
              <label style={styles.label}>Password</label>
              <input style={styles.input} type="password" value={form.password} onChange={update('password')}
                placeholder="Min 6 characters" required />
            </div>
            {mode === 'register' && (
              <div style={styles.fg}>
                <label style={styles.label}>College Name (optional)</label>
                <input style={styles.input} value={form.college} onChange={update('college')}
                  placeholder="e.g. Anna University" />
              </div>
            )}
            {error && <div style={styles.error}>{error}</div>}
            <button type="submit" style={styles.btn} disabled={loading}>
              {loading ? <span style={styles.spinner} /> : null}
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div style={styles.switchRow}>
            {mode === 'login' ? (
              <><span style={{ color: 'var(--mut)' }}>No account?</span>{' '}
                <button style={styles.link} onClick={() => { setMode('register'); setError(''); }}>Register</button></>
            ) : (
              <><span style={{ color: 'var(--mut)' }}>Already registered?</span>{' '}
                <button style={styles.link} onClick={() => { setMode('login'); setError(''); }}>Sign In</button></>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  page: {
    position: 'relative', zIndex: 1,
    minHeight: '100vh', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: '20px'
  },
  card: {
    background: 'var(--sur)', border: '1px solid var(--bor)',
    borderRadius: '20px', padding: '40px 36px', width: '100%', maxWidth: '420px',
    animation: 'fadeIn .4s ease'
  },
  logo: {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontWeight: 800, fontSize: '18px', marginBottom: '28px', color: 'var(--acc)'
  },
  dot: {
    width: '10px', height: '10px', borderRadius: '50%',
    background: 'var(--acc)', boxShadow: '0 0 10px var(--acc)',
    animation: 'blink 2s infinite'
  },
  title: { fontSize: '22px', fontWeight: 800, marginBottom: '6px' },
  sub:   { fontSize: '13px', color: 'var(--m2)', marginBottom: '28px' },
  fg:    { marginBottom: '16px' },
  label: {
    display: 'block', fontSize: '11px', fontWeight: 700,
    color: 'var(--mut)', textTransform: 'uppercase',
    letterSpacing: '0.55px', marginBottom: '7px'
  },
  input: {
    width: '100%', padding: '11px 14px',
    background: 'var(--s2)', border: '1px solid var(--bor)',
    borderRadius: '10px', color: 'var(--txt)', fontSize: '14px', outline: 'none'
  },
  error: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '8px', padding: '10px 14px',
    color: 'var(--red)', fontSize: '13px', marginBottom: '16px'
  },
  btn: {
    width: '100%', padding: '13px', borderRadius: '10px',
    background: 'var(--acc)', color: '#fff', fontSize: '15px',
    fontWeight: 700, border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    marginTop: '4px'
  },
  spinner: {
    width: '16px', height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff', borderRadius: '50%',
    animation: 'spin 0.6s linear infinite', display: 'inline-block'
  },
  switchRow: {
    marginTop: '20px', textAlign: 'center', fontSize: '13px'
  },
  link: {
    background: 'none', border: 'none', color: 'var(--acc)',
    fontWeight: 700, cursor: 'pointer', padding: '0 4px', fontSize: '13px'
  }
};
