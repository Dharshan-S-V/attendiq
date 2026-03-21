// pages/attend.js
// This page opens when a student scans the QR code
// URL: /attend?s=SESSION_ID

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const DEPTS = [
  'Computer Science Engineering', 'Information Technology',
  'Electronics & Communication', 'Electrical Engineering',
  'Mechanical Engineering', 'Civil Engineering', 'Biotechnology',
  'Artificial Intelligence & ML', 'Data Science',
  'Mathematics', 'Physics', 'Chemistry', 'Other'
];

export default function Attend() {
  const router = useRouter();
  const { s: sessionId } = router.query;

  const [session, setSession]   = useState(null);
  const [status, setStatus]     = useState('loading'); // loading|error|form|success
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult]     = useState(null);
  const [form, setForm]         = useState({ name:'', roll:'', regNo:'', department:'', year:'' });
  const [locState, setLocState] = useState('idle'); // idle|getting|ok|err
  const [locMsg, setLocMsg]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showGPSModal, setShowGPSModal] = useState(false);
  const [pendingCoords, setPendingCoords] = useState(null);

  // ── Load session from API ──
  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/sessions/${sessionId}`)
      .then(r => r.json().then(d => ({ ok: r.ok, status: r.status, ...d })))
      .then(d => {
        if (!d.ok) {
          setErrorMsg(d.status === 410 ? 'This QR code has expired. Ask your faculty to generate a new one.' : d.error || 'Session not found.');
          setStatus('error');
        } else {
          setSession(d.session);
          setStatus('form');
        }
      })
      .catch(() => {
        setErrorMsg('Could not connect to server. Check your internet connection.');
        setStatus('error');
      });
  }, [sessionId]);

  const upd = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function validate() {
    if (!form.name.trim())   { alert('Enter your full name'); return false; }
    if (!form.roll.trim())   { alert('Enter your roll number'); return false; }
    if (!form.department)    { alert('Select your department'); return false; }
    if (!form.year)          { alert('Select your year'); return false; }
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
    setLocMsg('Acquiring GPS signal…');
    setSubmitting(true);

    if (!navigator.geolocation) {
      setLocState('err');
      setLocMsg('GPS not supported on this device.');
      setSubmitting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude, accuracy } = pos.coords;
        setLocState('ok');
        setLocMsg(`Got location (±${Math.round(accuracy)}m accuracy)`);
        submitRecord(latitude, longitude, accuracy);
      },
      err => {
        setLocState('err');
        setLocMsg('GPS error: ' + err.message);
        setSubmitting(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  async function submitRecord(lat, lng, accuracy) {
    try {
      const r = await fetch('/api/records/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          name: form.name.trim(),
          roll: form.roll.trim(),
          regNo: form.regNo.trim(),
          department: form.department,
          year: form.year,
          lat, lng, accuracy
        })
      });
      const d = await r.json();
      if (!r.ok) {
        setLocState('err');
        setLocMsg(d.error || 'Submission failed');
        setSubmitting(false);
        return;
      }
      setResult(d);
      setStatus('success');
    } catch {
      setLocState('err');
      setLocMsg('Network error. Check your connection.');
      setSubmitting(false);
    }
  }

  // ── LOADING ──
  if (status === 'loading' || !sessionId) return (
    <>
      <Head><title>AttendIQ — Loading…</title></Head>
      <div style={S.center}>
        <div style={S.spinner} />
        <p style={{ color:'var(--m2)', fontSize:'14px', marginTop:'16px' }}>Loading session…</p>
      </div>
    </>
  );

  // ── ERROR ──
  if (status === 'error') return (
    <>
      <Head><title>AttendIQ — Error</title></Head>
      <div style={S.center}>
        <div style={{ fontSize:'56px', marginBottom:'16px' }}>⚠️</div>
        <h2 style={{ fontSize:'20px', fontWeight:800, marginBottom:'8px' }}>Cannot Load Session</h2>
        <p style={{ color:'var(--m2)', fontSize:'13px', maxWidth:'320px', textAlign:'center', lineHeight:'1.6' }}>{errorMsg}</p>
      </div>
    </>
  );

  // ── SUCCESS ──
  if (status === 'success' && result) {
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
                ? `You are ${result.distance}m from the classroom — within the ${result.radius}m allowed zone.`
                : `You are ${result.distance}m away. You must be within ${result.radius}m of the classroom.`}
            </p>
            <div style={S.detailBox}>
              {[
                ['Name',       result.record.name],
                ['Roll No.',   result.record.roll],
                ['Reg No.',    result.record.reg_no || '—'],
                ['Department', result.record.department],
                ['Year',       result.record.year + ' Year'],
                ['Subject',    session?.subject],
                ['Distance',   result.distance + 'm (±' + result.record.accuracy + 'm GPS)'],
                ['Time',       new Date(result.record.marked_at).toLocaleTimeString()],
                ['Status',     result.status],
              ].map(([k, v]) => (
                <div key={k} style={S.detailRow}>
                  <span style={{ color:'var(--mut)' }}>{k}</span>
                  {k === 'Status'
                    ? <span style={ok ? S.bdgG : S.bdgR}>● {v}</span>
                    : <span style={{ fontWeight:700, fontFamily:'var(--mono)', fontSize:'12px' }}>{v}</span>
                  }
                </div>
              ))}
            </div>
            {!ok && (
              <button style={{ ...S.btnP, marginTop:'20px' }} onClick={() => { setStatus('form'); setLocState('idle'); setSubmitting(false); }}>
                ← Try Again
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
            {session?.date && <span style={S.pill2}>{session.date}{session?.timeSlot ? ' · ' + session.timeSlot : ''}</span>}
          </div>
        </div>

        {/* Form */}
        <div style={S.formCard}>
          <div style={{ fontSize:'16px', fontWeight:700, marginBottom:'4px' }}>Your Details</div>
          <div style={{ fontSize:'12px', color:'var(--mut)', marginBottom:'20px' }}>
            Fill in all fields — your GPS will be checked when you submit
          </div>

          <Fg label="Full Name *">
            <input style={S.inp} value={form.name} onChange={upd('name')}
              placeholder="Enter your full name" autoComplete="name" />
          </Fg>

          <div style={S.r2}>
            <Fg label="Roll Number *">
              <input style={S.inp} value={form.roll} onChange={upd('roll')}
                placeholder="e.g. CS21B001" autoComplete="off" />
            </Fg>
            <Fg label="Register Number">
              <input style={S.inp} value={form.regNo} onChange={upd('regNo')}
                placeholder="e.g. 211501001" autoComplete="off" />
            </Fg>
          </div>

          <div style={S.r2}>
            <Fg label="Department *">
              <select style={S.inp} value={form.department} onChange={upd('department')}>
                <option value="">Select Department</option>
                {DEPTS.map(d => <option key={d}>{d}</option>)}
              </select>
            </Fg>
            <Fg label="Year *">
              <select style={S.inp} value={form.year} onChange={upd('year')}>
                <option value="">Select Year</option>
                <option value="I">I Year</option>
                <option value="II">II Year</option>
                <option value="III">III Year</option>
                <option value="IV">IV Year</option>
              </select>
            </Fg>
          </div>

          <div style={S.divider} />

          <div style={{ fontSize:'12px', fontWeight:700, marginBottom:'6px' }}>📍 Location Verification</div>
          <div style={{ fontSize:'12px', color:'var(--m2)', marginBottom:'10px', lineHeight:'1.6' }}>
            Tapping Submit will request your GPS to confirm you are physically inside the classroom.
            You must be within <strong>{session?.radius}m</strong> of the classroom.
          </div>

          {locState !== 'idle' && (
            <div style={{ ...S.locBar, borderColor: locState==='ok'?'rgba(34,197,94,.3)':locState==='err'?'rgba(239,68,68,.3)':'rgba(245,158,11,.3)' }}>
              <div style={{ ...S.locDot,
                background: locState==='ok'?'var(--grn)':locState==='err'?'var(--red)':'var(--yel)',
                animation: locState==='getting'?'blink 1s infinite':'none'
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
              ? <><SpinIcon /> Verifying…</>
              : 'Submit & Verify Location'
            }
          </button>
        </div>
      </div>

      {/* GPS Permission Modal */}
      {showGPSModal && (
        <div style={S.modalBg}>
          <div style={S.modal}>
            <div style={S.gpsAnim}><div style={{ fontSize:'22px', position:'relative', zIndex:1 }}>📡</div></div>
            <h3 style={{ fontSize:'18px', fontWeight:800, marginBottom:'6px' }}>Allow Location Access</h3>
            <p style={{ color:'var(--m2)', fontSize:'13px', marginBottom:'20px', lineHeight:'1.6' }}>
              AttendIQ needs your GPS to confirm you are physically inside the classroom.
              Your location is only used for this attendance check.
            </p>
            <div style={{ display:'flex', gap:'10px', justifyContent:'center' }}>
              <button style={S.btnS} onClick={denyGPS}>Deny</button>
              <button style={S.btnP} onClick={allowGPS}>Allow & Submit</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Fg({ label, children }) {
  return (
    <div style={{ marginBottom:'16px' }}>
      <label style={{ display:'block', fontSize:'11px', fontWeight:700, color:'var(--mut)', textTransform:'uppercase', letterSpacing:'.55px', marginBottom:'7px' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SpinIcon() {
  return <div style={{ width:'16px', height:'16px', border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .6s linear infinite', display:'inline-block' }} />;
}

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
    background:'var(--s2)', border:'1px solid var(--bor)',
    borderRadius:'10px', color:'var(--txt)', fontFamily:'var(--fnt)',
    fontSize:'14px', outline:'none'
  },
  r2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'13px' },
  divider: { height:'1px', background:'var(--bor)', margin:'18px 0' },
  locBar: {
    display:'flex', alignItems:'center', gap:'10px',
    padding:'11px 14px', borderRadius:'10px',
    background:'var(--s2)', border:'1px solid', fontSize:'13px'
  },
  locDot: { width:'8px', height:'8px', borderRadius:'50%', flexShrink:0 },
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
  detailRow: { display:'flex', justifyContent:'space-between', alignItems:'center' },
  bdgG: { display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:700, background:'rgba(34,197,94,.12)', color:'var(--grn)', border:'1px solid rgba(34,197,94,.25)' },
  bdgR: { display:'inline-flex', alignItems:'center', gap:'4px', padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:700, background:'rgba(239,68,68,.12)', color:'var(--red)', border:'1px solid rgba(239,68,68,.25)' },
};
