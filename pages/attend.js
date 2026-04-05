// pages/attend.js
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const DEPTS = [
  'CSE-A','CSE-B','CSE-C','AIDS','AIML','CSBS','IT',
  'EEE','ECE-A','ECE-B','CHEMICAL','BME','CIVIL','MECHANICAL'
];

export default function Attend() {
  const router = useRouter();
  const { s: sessionId } = router.query;

  const [session,    setSession]    = useState(null);
  const [pageStatus, setPageStatus] = useState('loading');
  const [errorMsg,   setErrorMsg]   = useState('');
  const [result,     setResult]     = useState(null);
  const [form,       setForm]       = useState({ name:'', roll:'', email:'', department:'', year:'' });
  const [rollErr,    setRollErr]    = useState('');
  const [emailErr,   setEmailErr]   = useState('');
  const [locState,   setLocState]   = useState('idle');
  const [locMsg,     setLocMsg]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showModal,  setShowModal]  = useState(false);
  const [scrolled,   setScrolled]   = useState(false);
  const [deviceId,   setDeviceId]   = useState('');
  const pageRef = useRef(null);

  // Scroll listener for sticky glass nav
  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    const handler = () => setScrolled(el.scrollTop > 10);
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [pageRef.current]);

  // Generate or retrieve device fingerprint from localStorage
  // This is unique per phone/browser — persists across page reloads
  useEffect(() => {
    try {
      let did = localStorage.getItem('iq_device_id');
      if (!did) {
        did = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('iq_device_id', did);
      }
      setDeviceId(did);
    } catch(e) {
      // localStorage not available — generate temporary ID
      setDeviceId('tmp_' + Date.now().toString(36));
    }
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/sessions/${sessionId}`)
      .then(r => r.json().then(d => ({ ok: r.ok, httpStatus: r.status, ...d })))
      .then(d => {
        if (!d.ok) {
          setErrorMsg(d.httpStatus === 410 ? 'This QR code has expired. Ask your faculty to generate a new one.' : d.error || 'Session not found.');
          setPageStatus('error');
        } else { setSession(d.session); setPageStatus('form'); }
      })
      .catch(() => { setErrorMsg('Could not connect. Check your internet.'); setPageStatus('error'); });
  }, [sessionId]);

  const upd = k => e => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    if (k === 'roll')  setRollErr('');
    if (k === 'email') setEmailErr('');
  };

  function validateRoll(v) {
    if (!/^\d{2}[a-z]{2,4}\d{3}$/.test(v.trim().toLowerCase())) { setRollErr('Format: 23am019'); return false; }
    setRollErr(''); return true;
  }

  function validateEmail(v) {
    if (!v.trim() || !v.includes('@') || !v.includes('.')) { setEmailErr('Enter a valid email'); return false; }
    setEmailErr(''); return true;
  }

  function validate() {
    if (!form.name.trim())          { alert('Enter your full name'); return false; }
    if (!validateRoll(form.roll))   return false;
    if (!validateEmail(form.email)) return false;
    if (!form.department)           { alert('Select your department'); return false; }
    if (!form.year)                 { alert('Select your year'); return false; }
    return true;
  }

  function handleSubmit() { if (!validate()) return; setShowModal(true); }
  function denyGPS()      { setShowModal(false); alert('Location is required to verify attendance.'); }

  function allowGPS() {
    setShowModal(false);
    setLocState('getting');
    setLocMsg('Getting your location…');
    setSubmitting(true);

    if (!navigator.geolocation) {
      setLocState('err'); setLocMsg('GPS not supported on this device.'); setSubmitting(false); return;
    }

    // Use a single getCurrentPosition call with high accuracy.
    // watchPosition was causing issues when phone is connected via hotspot —
    // multiple readings kept returning the WiFi/hotspot location instead of
    // the actual GPS chip position.
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        setLocState('ok');
        setLocMsg('Location verified. Submitting…');
        doSubmit(latitude, longitude, accuracy);
      },
      err => {
        setLocState('err');
        setLocMsg('Location error. Please allow GPS and try again.');
        setSubmitting(false);
      },
      {
        enableHighAccuracy: true,   // forces GPS chip, not WiFi
        timeout:            20000,  // wait up to 20s for GPS chip fix
        maximumAge:         0       // never use cached location
      }
    );
  }

  async function doSubmit(lat, lng, accuracy) {
    try {
      const r = await fetch('/api/records/mark', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, name:form.name.trim(), roll:form.roll.trim().toLowerCase(), email:form.email.trim().toLowerCase(), department:form.department, year:form.year, lat, lng, accuracy, deviceId })
      });
      const d = await r.json();
      if (!r.ok) { setLocState('err'); setLocMsg(d.error || 'Submission failed.'); setSubmitting(false); return; }
      setResult(d); setPageStatus('success');
    } catch { setLocState('err'); setLocMsg('Network error. Try again.'); setSubmitting(false); }
  }

  // ── LOADING ──
  if (pageStatus === 'loading' || !sessionId) return (
    <>
      <Head><title>AttendIQ</title></Head>
      <div style={S.center}>
        <div style={S.spinner}/>
        <p style={{ color:'var(--txt3)', fontSize:'14px', marginTop:'14px' }}>Loading session…</p>
      </div>
    </>
  );

  // ── ERROR ──
  if (pageStatus === 'error') return (
    <>
      <Head><title>AttendIQ — Error</title></Head>
      <div style={S.center}>
        <div style={{ fontSize:'52px', marginBottom:'14px' }}>⚠️</div>
        <h2 style={{ fontSize:'20px', fontWeight:700, letterSpacing:'-0.4px', marginBottom:'8px' }}>Session Unavailable</h2>
        <p style={{ color:'var(--txt3)', fontSize:'14px', maxWidth:'300px', textAlign:'center', lineHeight:'1.6' }}>{errorMsg}</p>
      </div>
    </>
  );

  // ── SUCCESS ──
  if (pageStatus === 'success' && result) {
    const ok = result.status === 'present';
    return (
      <>
        <Head><title>AttendIQ — {ok ? 'Present ✅' : 'Out of Range'}</title></Head>
        <div ref={pageRef} style={{ ...S.page, overflowY:'auto' }}>
          {/* Sticky glass nav */}
          <div className={`attend-nav${scrolled ? ' scrolled' : ''}`} style={{ padding:'0 16px' }}>
            <LogoMark/><span style={S.navTitle}>AttendIQ</span>
          </div>

          <div style={{ padding:'0 16px 60px', maxWidth:'500px', margin:'0 auto' }}>
            <div style={{ ...S.resultCard, animation:'fadeUp .5s ease' }}>
              <div style={{ fontSize:'60px', marginBottom:'14px', animation:'pop .5s cubic-bezier(.34,1.56,.64,1)' }}>{ok ? '✅' : '❌'}</div>
              <h2 style={{ fontSize:'22px', fontWeight:700, color: ok ? '#248a3d' : '#c41e1e', letterSpacing:'-0.4px', marginBottom:'8px' }}>
                {ok ? 'Attendance Marked!' : 'Out of Range'}
              </h2>
              <p style={{ color:'var(--txt3)', fontSize:'14px', marginBottom:'24px', lineHeight:'1.6' }}>
                {ok
                  ? `You are ${result.distance}m from the classroom — within the ${result.effectiveRadius}m zone.`
                  : `You are ${result.distance}m away. Allowed zone is ${result.effectiveRadius}m.`
                }
              </p>

              <div style={S.detailCard}>
                {[
                  ['Name',       result.record.name],
                  ['Roll No.',   result.record.roll],
                  ['Email',      result.record.email],
                  ['Department', result.record.department],
                  ['Year',       result.record.year + ' Year'],
                  ['Subject',    session?.subject],
                  ['Time',       new Date(result.record.marked_at).toLocaleTimeString()],
                  ['Status',     result.status],
                ].map(([k, v]) => (
                  <div key={k} style={S.detailRow}>
                    <span style={{ color:'var(--txt4)', fontSize:'13px' }}>{k}</span>
                    {k === 'Status'
                      ? <span style={{ fontSize:'13px', fontWeight:600, color: ok ? '#248a3d' : '#c41e1e' }}>{ok ? '● Present' : '● Absent'}</span>
                      : <span style={{ fontSize:'13px', fontWeight:600, fontFamily: (k==='Roll No.'||k==='Time') ? 'var(--mono)' : undefined }}>{v}</span>
                    }
                  </div>
                ))}
              </div>



              {!ok && (
                <div style={{ marginTop:'20px' }}>
                  <div style={{ background:'var(--yel-bg)', border:'1px solid rgba(255,159,10,0.2)', borderRadius:'10px', padding:'12px 14px', marginBottom:'14px', fontSize:'13px', color:'var(--txt2)', lineHeight:'1.6' }}>
                    <strong style={{ color:'var(--yel)', display:'block', marginBottom:'3px' }}>Out of Range</strong>
                    Move physically closer to the classroom and tap Try Again. Your previous attempt has been cleared so you can resubmit.
                  </div>
                  <button style={{ ...S.primaryBtn, background:'var(--yel)', boxShadow:'0 2px 12px rgba(255,159,10,0.25)' }}
                    onClick={() => { setPageStatus('form'); setLocState('idle'); setSubmitting(false); }}>
                    Try Again — Move Closer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── FORM ──
  return (
    <>
      <Head><title>AttendIQ — {session?.subject || 'Attendance'}</title></Head>
      <div ref={pageRef} style={S.page}>

        {/* Sticky glass nav — activates on scroll */}
        <div className={`attend-nav${scrolled ? ' scrolled' : ''}`} style={{ padding:'0 16px' }}>
          <LogoMark/><span style={S.navTitle}>AttendIQ</span>
        </div>

        <div style={{ padding:'0 16px 60px', maxWidth:'500px', margin:'0 auto' }}>

          {/* Session info card */}
          <div style={{ ...S.sessionCard, animation:'fadeUp .35s ease' }}>
            <div style={{ fontWeight:700, fontSize:'18px', letterSpacing:'-0.4px', marginBottom:'6px' }}>{session?.subject}</div>
            {session?.section && <div style={{ fontSize:'13px', color:'var(--txt3)', marginBottom:'8px' }}>{session.section}</div>}
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              <Tag>📍 {session?.location}</Tag>
              {session?.date && <Tag>{session.date}{session?.timeSlot ? ' · '+session.timeSlot : ''}</Tag>}
            </div>
          </div>

          {/* Form card */}
          <div style={{ ...S.formCard, animation:'fadeUp .45s ease' }}>
            <h2 style={{ fontSize:'17px', fontWeight:700, letterSpacing:'-0.3px', marginBottom:'4px' }}>Your Details</h2>
            <p style={{ fontSize:'13px', color:'var(--txt3)', marginBottom:'22px' }}>Fill all fields — GPS verified on submit</p>

            <FF label="Full Name">
              <input style={S.inp} value={form.name} onChange={upd('name')} placeholder="Enter your full name" autoComplete="name"/>
            </FF>

            <FF label="Roll Number" hint="Format: 23am019" error={rollErr}>
              <input
                style={{ ...S.inp, borderColor: rollErr ? 'var(--red)' : undefined }}
                value={form.roll} onChange={upd('roll')}
                onBlur={() => form.roll && validateRoll(form.roll)}
                placeholder="e.g. 23am019" autoCapitalize="none" autoComplete="off"
              />
            </FF>

            <FF label="Email Address" hint="One submission per email per session" error={emailErr}>
              <input
                style={{ ...S.inp, borderColor: emailErr ? 'var(--red)' : undefined }}
                type="email" value={form.email} onChange={upd('email')}
                onBlur={() => form.email && validateEmail(form.email)}
                placeholder="yourname@college.edu" autoComplete="email" inputMode="email"
              />
            </FF>

            <div style={S.r2}>
              <FF label="Department">
                <select style={S.sel} value={form.department} onChange={upd('department')}>
                  <option value="">Select</option>
                  {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </FF>
              <FF label="Year">
                <select style={S.sel} value={form.year} onChange={upd('year')}>
                  <option value="">Select</option>
                  {['I','II','III','IV'].map(y => <option key={y} value={y}>{y} Year</option>)}
                </select>
              </FF>
            </div>

            <div style={S.divider}/>

            <div style={{ fontSize:'13px', fontWeight:600, color:'var(--txt2)', marginBottom:'6px' }}>Location Verification</div>
            <div style={{ fontSize:'13px', color:'var(--txt3)', marginBottom:'12px', lineHeight:'1.6' }}>
              Your GPS location will be checked when you submit. Please allow location access when prompted.
            </div>

            {locState !== 'idle' && (
              <div style={{
                display:'flex', alignItems:'center', gap:'10px', padding:'11px 14px',
                borderRadius:'10px', marginBottom:'12px',
                background: locState==='err' ? 'var(--red-bg)' : locState==='ok' ? 'var(--grn-bg)' : 'var(--yel-bg)',
                border: `1px solid ${locState==='err' ? 'rgba(255,59,48,0.2)' : locState==='ok' ? 'rgba(52,199,89,0.2)' : 'rgba(255,159,10,0.2)'}`,
              }}>
                <div style={{
                  width:'7px', height:'7px', borderRadius:'50%', flexShrink:0,
                  background: locState==='err' ? 'var(--red)' : locState==='ok' ? 'var(--grn)' : 'var(--yel)',
                  animation: locState==='getting' ? 'pulse 1s infinite' : 'none',
                }}/>
                <span style={{ fontSize:'13px', fontWeight:500, color: locState==='err' ? 'var(--red)' : 'var(--txt2)' }}>{locMsg}</span>
              </div>
            )}

            <button
              style={{ ...S.primaryBtn, opacity: submitting ? .65 : 1 }}
              onClick={handleSubmit} disabled={submitting}>
              {submitting
                ? <><div style={S.btnSpin}/> Verifying…</>
                : 'Submit & Verify Location'
              }
            </button>
          </div>
        </div>
      </div>

      {/* GPS Permission Modal — slides up from bottom */}
      {showModal && (
        <div style={S.modalOverlay}>
          <div style={S.modal}>
            <div style={S.modalHandle}/>
            <div style={S.modalIconBox}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="1.8" strokeLinecap="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                <circle cx="12" cy="12" r="9" strokeDasharray="3 4"/>
              </svg>
            </div>
            <h3 style={{ fontSize:'18px', fontWeight:700, letterSpacing:'-0.4px', marginBottom:'8px' }}>Allow Location Access</h3>
            <p style={{ color:'var(--txt3)', fontSize:'14px', marginBottom:'6px', lineHeight:'1.6' }}>
              AttendIQ needs your GPS location to verify you are physically present in the classroom.
            </p>
            <p style={{ color:'var(--yel)', fontSize:'13px', fontWeight:500, marginBottom:'24px' }}>
              💡 Make sure your phone location is turned ON before tapping Allow.
            </p>
            <div style={{ display:'flex', gap:'10px' }}>
              <button style={S.outlineBtn} onClick={denyGPS}>Deny</button>
              <button style={{ ...S.primaryBtn, flex:1 }} onClick={allowGPS}>Allow &amp; Submit</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Helpers ─────────────────────────────────────────────
function LogoMark() {
  return (
    <div style={{ borderRadius:'7px', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,113,227,0.2)', flexShrink:0 }}>
      <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" fill="#0071e3"/>
        <path d="M7 14h14M14 7l7 7-7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function Tag({ children }) {
  return <span style={{ display:'inline-flex', alignItems:'center', padding:'4px 10px', borderRadius:'20px', fontSize:'12px', fontWeight:500, background:'var(--acc-light)', color:'var(--acc)', border:'1px solid var(--acc-mid)' }}>{children}</span>;
}

function FF({ label, hint, error, children }) {
  return (
    <div style={{ marginBottom:'16px' }}>
      <label style={{ display:'block', fontSize:'13px', fontWeight:500, color:'var(--txt3)', marginBottom:'7px' }}>{label}</label>
      {children}
      {error && <div style={{ fontSize:'12px', color:'var(--red)', marginTop:'5px', fontWeight:500 }}>{error}</div>}
      {!error && hint && <div style={{ fontSize:'11px', color:'var(--txt4)', marginTop:'4px' }}>{hint}</div>}
    </div>
  );
}

const S = {
  center:    { display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', padding:'20px', textAlign:'center', background:'var(--bg)' },
  spinner:   { width:'32px', height:'32px', border:'2.5px solid var(--border2)', borderTopColor:'var(--acc)', borderRadius:'50%', animation:'spin .7s linear infinite' },

  page:      { background:'var(--bg)', minHeight:'100vh', overflowY:'auto' },
  navTitle:  { fontSize:'16px', fontWeight:600, letterSpacing:'-0.3px', color:'var(--txt)' },

  sessionCard: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'20px', marginBottom:'12px', boxShadow:'var(--shadow-sm)' },
  formCard:    { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'24px', boxShadow:'var(--shadow-sm)' },

  inp: { width:'100%', padding:'11px 13px', background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:'10px', fontSize:'15px', color:'var(--txt)', outline:'none', transition:'border-color .2s' },
  sel: { width:'100%', padding:'11px 13px', background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:'10px', fontSize:'14px', color:'var(--txt)', outline:'none', WebkitAppearance:'none', appearance:'none' },
  r2:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' },
  divider: { height:'1px', background:'var(--border)', margin:'18px 0' },

  primaryBtn: { width:'100%', padding:'13px', borderRadius:'10px', background:'var(--acc)', color:'#fff', border:'none', fontSize:'15px', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', boxShadow:'0 2px 12px rgba(0,113,227,0.25)', letterSpacing:'-0.2px' },
  outlineBtn: { flex:1, padding:'13px', borderRadius:'10px', background:'transparent', color:'var(--txt2)', border:'1.5px solid var(--border2)', fontSize:'15px', fontWeight:600, cursor:'pointer' },
  btnSpin:    { width:'15px', height:'15px', border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .6s linear infinite' },

  modalOverlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', zIndex:300, display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'0 12px 12px' },
  modal:        { background:'var(--surface)', borderRadius:'var(--r-xl)', padding:'20px 24px 28px', width:'100%', maxWidth:'460px', boxShadow:'var(--shadow-xl)', animation:'slideUp .4s cubic-bezier(0.34,1.2,0.64,1)', textAlign:'center' },
  modalHandle:  { width:'36px', height:'4px', borderRadius:'2px', background:'var(--border2)', margin:'0 auto 20px' },
  modalIconBox: { width:'56px', height:'56px', borderRadius:'14px', background:'var(--acc-light)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' },

  resultCard:  { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-xl)', padding:'32px 24px', textAlign:'center', boxShadow:'var(--shadow-md)' },
  detailCard:  { background:'var(--surface2)', borderRadius:'12px', padding:'14px', textAlign:'left', border:'1px solid var(--border)' },
  detailRow:   { display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px', padding:'7px 0', borderBottom:'1px solid var(--border)' },
};
