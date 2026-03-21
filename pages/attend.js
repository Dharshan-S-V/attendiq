// pages/attend.js
// Student attendance form — opens when QR is scanned
// Changes: new dept list, roll format 23am019, email field (auto-detect + dedup),
//          removed regNo, accurate GPS with buffer, detailed result

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const DEPTS = [
  'CSE-A','CSE-B','CSE-C',
  'AIDS','AIML','CSBS','IT',
  'EEE','ECE-A','ECE-B',
  'CHEMICAL','BME','CIVIL','MECHANICAL'
];

export default function Attend() {
  const router = useRouter();
  const { s: sessionId } = router.query;

  const [session,      setSession]      = useState(null);
  const [pageStatus,   setPageStatus]   = useState('loading'); // loading|error|form|success
  const [errorMsg,     setErrorMsg]     = useState('');
  const [result,       setResult]       = useState(null);
  const [form,         setForm]         = useState({ name:'', roll:'', email:'', department:'', year:'' });
  const [rollErr,      setRollErr]      = useState('');
  const [emailErr,     setEmailErr]     = useState('');
  const [locState,     setLocState]     = useState('idle'); // idle|getting|ok|err
  const [locMsg,       setLocMsg]       = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [showGPSModal, setShowGPSModal] = useState(false);

  // ── Load session ──
  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/sessions/${sessionId}`)
      .then(r => r.json().then(d => ({ ok: r.ok, httpStatus: r.status, ...d })))
      .then(d => {
        if (!d.ok) {
          setErrorMsg(
            d.httpStatus === 410
              ? 'This QR code has expired. Ask your faculty to generate a new one.'
              : d.error || 'Session not found.'
          );
          setPageStatus('error');
        } else {
          setSession(d.session);
          setPageStatus('form');
        }
      })
      .catch(() => {
        setErrorMsg('Could not connect to server. Check your internet connection.');
        setPageStatus('error');
      });
  }, [sessionId]);

  // ── Auto-detect email from device (Google sign-in hint) ──
  useEffect(() => {
    // Try to pre-fill email using browser credential management API
    if (window.PasswordCredential || window.FederatedCredential) {
      navigator.credentials?.get({ password: true, federated: { providers: ['https://accounts.google.com'] } })
        .then(cred => { if (cred?.id && cred.id.includes('@')) setForm(f => ({ ...f, email: cred.id })); })
        .catch(() => {});
    }
  }, []);

  const upd = k => e => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    if (k === 'roll') setRollErr('');
    if (k === 'email') setEmailErr('');
  };

  // ── Roll number validation: format 23am019 ──
  function validateRoll(val) {
    const clean = val.trim().toLowerCase();
    const regex = /^\d{2}[a-z]{2,4}\d{3}$/;
    if (!regex.test(clean)) {
      setRollErr('Format must be like 23am019 (2 digits + letters + 3 digits)');
      return false;
    }
    setRollErr('');
    return true;
  }

  function validateEmail(val) {
    const clean = val.trim();
    if (!clean || !clean.includes('@') || !clean.includes('.')) {
      setEmailErr('Enter a valid email address');
      return false;
    }
    setEmailErr('');
    return true;
  }

  function validate() {
    if (!form.name.trim())        { alert('Enter your full name'); return false; }
    if (!validateRoll(form.roll)) return false;
    if (!validateEmail(form.email)) return false;
    if (!form.department)         { alert('Select your department'); return false; }
    if (!form.year)               { alert('Select your year'); return false; }
    return true;
  }

  function handleSubmit() {
    if (!validate()) return;
    setShowGPSModal(true);
  }

  function denyGPS() {
    setShowGPSModal(false);
    alert('Location access is required to verify your attendance. Please allow location and try again.');
  }

  function allowGPS() {
    setShowGPSModal(false);
    setLocState('getting');
    setLocMsg('Acquiring GPS signal… (this may take a few seconds)');
    setSubmitting(true);

    if (!navigator.geolocation) {
      setLocState('err');
      setLocMsg('GPS not supported on this device.');
      setSubmitting(false);
      return;
    }

    // ── Key GPS settings for accuracy ──
    // enableHighAccuracy: true  → uses GPS chip, not just WiFi/cell tower
    // timeout: 20000            → wait up to 20s for a good fix
    // maximumAge: 0             → never use a cached position
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        setLocState('ok');
        setLocMsg(`GPS acquired (±${Math.round(accuracy)}m accuracy). Verifying…`);
        submitRecord(latitude, longitude, accuracy);
      },
      err => {
        setLocState('err');
        setLocMsg('GPS error: ' + err.message + '. Please enable location and retry.');
        setSubmitting(false);
      },
      {
        enableHighAccuracy: true,
        timeout:            20000,
        maximumAge:         0
      }
    );
  }

  async function submitRecord(lat, lng, accuracy) {
    try {
      const r = await fetch('/api/records/mark', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          name:       form.name.trim(),
          roll:       form.roll.trim().toLowerCase(),
          email:      form.email.trim().toLowerCase(),
          department: form.department,
          year:       form.year,
          lat, lng, accuracy
        })
      });
      const d = await r.json();
      if (!r.ok) {
        setLocState('err');
        setLocMsg(d.error || 'Submission failed. Please try again.');
        setSubmitting(false);
        return;
      }
      setResult(d);
      setPageStatus('success');
    } catch {
      setLocState('err');
      setLocMsg('Network error. Check your connection and try again.');
      setSubmitting(false);
    }
  }

  // ── LOADING ──
  if (pageStatus === 'loading' || !sessionId) return (
    <>
      <Head><title>AttendIQ — Loading…</title></Head>
      <div style={S.center}>
        <div style={S.spinner} />
        <p style={{ color:'var(--m2)', fontSize:'14px', marginTop:'16px' }}>Loading session…</p>
      </div>
    </>
  );

  // ── ERROR ──
  if (pageStatus === 'error') return (
    <>
      <Head><title>AttendIQ — Error</title></Head>
      <div style={S.center}>
        <div style={{ fontSize:'56px', marginBottom:'16px' }}>⚠️</div>
        <h2 style={{ fontSize:'20px', fontWeight:800, marginBottom:'8px' }}>Cannot Load Session</h2>
        <p style={{ color:'var(--m2)', fontSize:'13px', maxWidth:'320px', textAlign:'center', lineHeight:'1.6' }}>
          {errorMsg}
        </p>
      </div>
    </>
  );

  // ── SUCCESS ──
  if (pageStatus === 'success' && result) {
    const ok = result.status === 'present';
    return (
      <>
        <Head><title>AttendIQ — {ok ? 'Present ✅' : 'Out of Range ❌'}</title></Head>
        <div style={S.outerWrap}>
          <div style={S.stuHeader}>
            <div style={S.logo}><div style={S.dot} />AttendIQ</div>
          </div>
          <div style={{ ...S.resCard, animation:'fadeIn .4s ease' }}>
            <div style={{ fontSize:'64px', marginBottom:'14px', animation:'pop .5s cubic-bezier(.34,1.56,.64,1)' }}>
              {ok ? '✅' : '❌'}
            </div>
            <h2 style={{ fontSize:'24px', fontWeight:800, color: ok ? 'var(--grn)' : 'var(--red)', marginBottom:'6px' }}>
              {ok ? 'Attendance Marked!' : 'Out of Range'}
            </h2>
            <p style={{ color:'var(--m2)', fontSize:'13px', marginBottom:'22px', lineHeight:'1.6' }}>
              {ok
                ? `You are ${result.distance}m from the classroom — within the ${result.effectiveRadius}m effective zone.`
                : `You are ${result.distance}m away. Effective allowed range is ${result.effectiveRadius}m (set radius ${result.radius}m + GPS buffer ${result.accuracyBuffer}m).`
              }
            </p>

            <div style={S.detailBox}>
              {[
                ['Name',       result.record.name],
                ['Roll No.',   result.record.roll],
                ['Email',      result.record.email],
                ['Department', result.record.department],
                ['Year',       result.record.year + ' Year'],
                ['Subject',    session?.subject],
                ['Distance',   result.distance + 'm'],
                ['Set Radius', result.radius + 'm'],
                ['GPS Buffer', '+' + result.accuracyBuffer + 'm (accuracy ±' + result.record.accuracy + 'm)'],
                ['Eff. Radius',result.effectiveRadius + 'm'],
                ['Time',       new Date(result.record.marked_at).toLocaleTimeString()],
                ['Status',     result.status],
              ].map(([k, v]) => (
                <div key={k} style={S.detailRow}>
                  <span style={{ color:'var(--mut)', fontSize:'12px' }}>{k}</span>
                  {k === 'Status'
                    ? <span style={ok ? S.bdgG : S.bdgR}>● {v}</span>
                    : <span style={{ fontWeight:700, fontFamily:'var(--mono)', fontSize:'12px' }}>{v}</span>
                  }
                </div>
              ))}
            </div>

            {!ok && (
              <button
                style={{ ...S.btnP, marginTop:'20px' }}
                onClick={() => { setPageStatus('form'); setLocState('idle'); setSubmitting(false); }}
              >
                ← Try Again (move closer)
              </button>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── FORM ──
  return (
    <>
      <Head><title>AttendIQ — {session?.subject || 'Attendance'}</title></Head>
      <div style={S.outerWrap}>

        {/* Header */}
        <div style={S.stuHeader}>
          <div style={S.logo}><div style={S.dot} />AttendIQ</div>
          <h1 style={{ fontSize:'19px', fontWeight:800, marginBottom:'4px' }}>{session?.subject}</h1>
          {session?.section && <p style={{ fontSize:'12px', color:'var(--m2)' }}>{session.section}</p>}
          <div style={{ marginTop:'10px', display:'flex', gap:'8px', justifyContent:'center', flexWrap:'wrap' }}>
            <span style={S.pill}>📍 {session?.location}</span>
            {session?.date && (
              <span style={S.pill2}>{session.date}{session?.timeSlot ? ' · ' + session.timeSlot : ''}</span>
            )}
          </div>
        </div>

        {/* Form */}
        <div style={S.formCard}>
          <div style={{ fontSize:'16px', fontWeight:700, marginBottom:'4px' }}>Your Details</div>
          <div style={{ fontSize:'12px', color:'var(--mut)', marginBottom:'20px' }}>
            Fill in all fields accurately — GPS will be checked on submit
          </div>

          {/* Full Name */}
          <Fg label="Full Name *">
            <input
              style={S.inp}
              value={form.name}
              onChange={upd('name')}
              placeholder="Enter your full name"
              autoComplete="name"
            />
          </Fg>

          {/* Roll Number */}
          <Fg label="Roll Number * (e.g. 23am019)">
            <input
              style={{ ...S.inp, borderColor: rollErr ? 'var(--red)' : 'var(--bor)' }}
              value={form.roll}
              onChange={upd('roll')}
              onBlur={() => form.roll && validateRoll(form.roll)}
              placeholder="e.g. 23am019"
              autoComplete="off"
              autoCapitalize="none"
            />
            {rollErr && <div style={S.fieldErr}>{rollErr}</div>}
          </Fg>

          {/* Email */}
          <Fg label="Email Address * (one submission per email)">
            <input
              style={{ ...S.inp, borderColor: emailErr ? 'var(--red)' : 'var(--bor)' }}
              type="email"
              value={form.email}
              onChange={upd('email')}
              onBlur={() => form.email && validateEmail(form.email)}
              placeholder="yourname@college.edu"
              autoComplete="email"
              inputMode="email"
            />
            {emailErr && <div style={S.fieldErr}>{emailErr}</div>}
            <div style={S.fieldHint}>Each email can only submit once per session</div>
          </Fg>

          {/* Department + Year */}
          <div style={S.r2}>
            <Fg label="Department *">
              <select
                style={S.inp}
                value={form.department}
                onChange={upd('department')}
              >
                <option value="">Select</option>
                {DEPTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Fg>
            <Fg label="Year *">
              <select style={S.inp} value={form.year} onChange={upd('year')}>
                <option value="">Select</option>
                <option value="I">I Year</option>
                <option value="II">II Year</option>
                <option value="III">III Year</option>
                <option value="IV">IV Year</option>
              </select>
            </Fg>
          </div>

          <div style={S.divider} />

          {/* Location section */}
          <div style={{ fontSize:'12px', fontWeight:700, marginBottom:'6px' }}>📍 Location Verification</div>
          <div style={{ fontSize:'12px', color:'var(--m2)', marginBottom:'10px', lineHeight:'1.6' }}>
            Tapping Submit will request your GPS. You must be physically inside the classroom.
            The system accounts for normal GPS accuracy variation automatically.
          </div>

          {locState !== 'idle' && (
            <div style={{
              ...S.locBar,
              borderColor: locState==='ok' ? 'rgba(34,197,94,.3)' : locState==='err' ? 'rgba(239,68,68,.3)' : 'rgba(245,158,11,.3)'
            }}>
              <div style={{
                ...S.locDot,
                background: locState==='ok' ? 'var(--grn)' : locState==='err' ? 'var(--red)' : 'var(--yel)',
                animation:  locState==='getting' ? 'blink 1s infinite' : 'none'
              }} />
              <span style={{ fontSize:'13px' }}>{locMsg}</span>
            </div>
          )}

          <button
            style={{ ...S.btnP, marginTop:'18px', opacity: submitting ? .6 : 1 }}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <><SpinIcon />&nbsp;Verifying…</>
              : 'Submit & Verify Location'
            }
          </button>
        </div>
      </div>

      {/* GPS Permission Modal */}
      {showGPSModal && (
        <div style={S.modalBg}>
          <div style={S.modal}>
            <div style={S.gpsAnim}>
              <div style={{ fontSize:'22px', position:'relative', zIndex:1 }}>📡</div>
            </div>
            <h3 style={{ fontSize:'18px', fontWeight:800, marginBottom:'6px' }}>Allow Location Access</h3>
            <p style={{ color:'var(--m2)', fontSize:'13px', marginBottom:'20px', lineHeight:'1.6' }}>
              AttendIQ needs your GPS to confirm you are physically inside the classroom.
              Your location is only used for this attendance check and stored securely.
            </p>
            <div style={{ display:'flex', gap:'10px', justifyContent:'center' }}>
              <button style={S.btnS} onClick={denyGPS}>Deny</button>
              <button style={S.btnP} onClick={allowGPS}>Allow &amp; Submit</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Helper Components ─────────────────────────────────────
function Fg({ label, children }) {
  return (
    <div style={{ marginBottom:'16px' }}>
      <label style={{
        display:'block', fontSize:'11px', fontWeight:700, color:'var(--mut)',
        textTransform:'uppercase', letterSpacing:'.55px', marginBottom:'7px'
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SpinIcon() {
  return (
    <div style={{
      width:'16px', height:'16px',
      border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff',
      borderRadius:'50%', animation:'spin .6s linear infinite', display:'inline-block'
    }} />
  );
}

// ── Styles ────────────────────────────────────────────────
const S = {
  center: {
    position:'relative', zIndex:1,
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    minHeight:'100vh', padding:'20px', textAlign:'center'
  },
  spinner: {
    width:'36px', height:'36px',
    border:'3px solid var(--bor)', borderTopColor:'var(--acc)',
    borderRadius:'50%', animation:'spin .7s linear infinite'
  },
  outerWrap: {
    position:'relative', zIndex:1,
    maxWidth:'480px', margin:'0 auto', padding:'24px 16px 60px'
  },
  stuHeader: {
    background:'var(--sur)', border:'1px solid var(--bor)',
    borderRadius:'16px', padding:'22px 20px', marginBottom:'18px',
    textAlign:'center', animation:'fadeIn .3s ease'
  },
  logo: {
    display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
    fontWeight:800, fontSize:'14px', color:'var(--acc)', marginBottom:'12px'
  },
  dot: {
    width:'8px', height:'8px', borderRadius:'50%',
    background:'var(--acc)', boxShadow:'0 0 10px var(--acc)', animation:'blink 2s infinite'
  },
  pill:  { display:'inline-flex', padding:'4px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:600, background:'rgba(59,130,246,.1)', color:'var(--acc)', border:'1px solid rgba(59,130,246,.2)' },
  pill2: { display:'inline-flex', padding:'4px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:600, background:'var(--s2)', color:'var(--m2)', border:'1px solid var(--bor)' },
  formCard: {
    background:'var(--sur)', border:'1px solid var(--bor)',
    borderRadius:'16px', padding:'24px', animation:'fadeIn .4s ease'
  },
  inp: {
    width:'100%', padding:'11px 14px',
    background:'var(--s2)', border:'1px solid',
    borderRadius:'10px', color:'var(--txt)', fontFamily:'var(--fnt)',
    fontSize:'14px', outline:'none', borderColor:'var(--bor)'
  },
  r2:       { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'13px' },
  divider:  { height:'1px', background:'var(--bor)', margin:'18px 0' },
  fieldErr: { fontSize:'11px', color:'var(--red)', marginTop:'5px', fontWeight:600 },
  fieldHint:{ fontSize:'11px', color:'var(--mut)', marginTop:'5px' },
  locBar: {
    display:'flex', alignItems:'center', gap:'10px',
    padding:'11px 14px', borderRadius:'10px',
    background:'var(--s2)', border:'1px solid', fontSize:'13px'
  },
  locDot:   { width:'8px', height:'8px', borderRadius:'50%', flexShrink:0 },
  btnP: {
    width:'100%', padding:'13px', borderRadius:'10px',
    background:'var(--acc)', color:'#fff', fontSize:'15px',
    fontWeight:700, border:'none', cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center', gap:'8px'
  },
  btnS: {
    padding:'11px 24px', borderRadius:'10px', fontSize:'14px', fontWeight:700,
    background:'var(--s2)', color:'var(--txt)', border:'1px solid var(--bor)', cursor:'pointer'
  },
  modalBg: {
    position:'fixed', inset:0, background:'rgba(0,0,0,.78)',
    backdropFilter:'blur(8px)', zIndex:300,
    display:'flex', alignItems:'center', justifyContent:'center', padding:'20px'
  },
  modal: {
    background:'var(--sur)', border:'1px solid var(--bor)', borderRadius:'20px',
    padding:'32px 28px', maxWidth:'400px', width:'100%', textAlign:'center',
    animation:'pop .3s cubic-bezier(.34,1.56,.64,1)'
  },
  gpsAnim: {
    width:'60px', height:'60px', margin:'0 auto 16px', position:'relative',
    display:'flex', alignItems:'center', justifyContent:'center'
  },
  resCard: {
    background:'var(--sur)', border:'1px solid var(--bor)', borderRadius:'16px',
    padding:'40px 28px', textAlign:'center'
  },
  detailBox: {
    background:'var(--s2)', borderRadius:'12px', padding:'14px',
    textAlign:'left', fontSize:'13px', display:'grid', gap:'8px'
  },
  detailRow: { display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px' },
  bdgG: { display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:700, background:'rgba(34,197,94,.12)', color:'var(--grn)', border:'1px solid rgba(34,197,94,.25)' },
  bdgR: { display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:700, background:'rgba(239,68,68,.12)', color:'var(--red)', border:'1px solid rgba(239,68,68,.25)' },
};
