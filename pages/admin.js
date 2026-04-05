// pages/admin.js
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

export default function Admin() {
  const router = useRouter();
  const [admin, setAdmin]           = useState(null);
  const [tab, setTab]               = useState('sessions');
  const [sessions, setSessions]     = useState([]);
  const [records, setRecords]       = useState([]);
  const [stats, setStats]           = useState({ total:0, present:0, absent:0 });
  const [activeQR, setActiveQR]     = useState(null);
  const [form, setForm]             = useState({
    subject:'', section:'', location:'', lat:'', lng:'',
    radius:'50', date:'', timeSlot:'', expiryMinutes:'30'  // date/time set in useEffect
  });
  const [formErr, setFormErr]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]           = useState(null);
  const [scrolled, setScrolled]     = useState(false);

  // IST date helpers — India Standard Time (UTC+5:30)
  function getISTDateString() {
    const now = new Date();
    // Offset to IST: UTC + 5h30m
    const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    return ist.toISOString().split('T')[0]; // YYYY-MM-DD
  }
  function getISTTimeString() {
    const now = new Date();
    const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    return ist.toISOString().split('T')[1].slice(0, 5); // HH:MM
  }
  const todayIST = getISTDateString();

  // Set default date (today IST) and time on mount
  useEffect(() => {
    setForm(f => ({ ...f, date: getISTDateString(), timeSlot: getISTTimeString() }));
  }, []);

  // ── Scroll listener -> glass nav ──
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => d ? setAdmin(d.admin) : router.push('/login'));
  }, []);

  const loadSessions = useCallback(() =>
    fetch('/api/sessions').then(r => r.ok && r.json()).then(d => d && setSessions(d.sessions)), []);

  const loadRecords = useCallback(() =>
    fetch('/api/records').then(r => r.ok && r.json()).then(d => {
      if (d) { setRecords(d.records); setStats(d.stats); }
    }), []);

  useEffect(() => { if (admin) { loadSessions(); loadRecords(); } }, [admin]);

  async function generateQR(e) {
    e.preventDefault(); setFormErr(''); setSubmitting(true);
    try {
      const r = await fetch('/api/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: form.subject, section: form.section, location: form.location,
          lat: parseFloat(form.lat), lng: parseFloat(form.lng),
          radius: parseInt(form.radius) || 50, date: form.date,
          timeSlot: form.timeSlot, expiryMinutes: parseInt(form.expiryMinutes)
        })
      });
      const d = await r.json();
      if (!r.ok) { setFormErr(d.error); return; }
      setActiveQR({ session: d.session, url: window.location.origin + '/attend?s=' + d.session.id });
      loadSessions(); showToast('QR code generated');
    } catch { setFormErr('Network error. Try again.'); }
    finally { setSubmitting(false); }
  }

  async function deleteSession(id) {
    if (!confirm('Delete this session?')) return;
    await fetch('/api/sessions/' + id, { method: 'DELETE' });
    if (activeQR?.session?.id === id) setActiveQR(null);
    loadSessions(); showToast('Session deleted');
  }

  function myLocation() {
    navigator.geolocation?.getCurrentPosition(
      p => { setForm(f => ({ ...f, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) })); showToast('Location captured'); },
      e => showToast('GPS error: ' + e.message, 'er'),
      { enableHighAccuracy: true }
    );
  }

  function showToast(msg, type = 'ok') { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }

  function exportAllCSV() {
    if (!records.length) { showToast('No records', 'er'); return; }
    const rows = [['#','Name','Roll','Email','Department','Year','Subject','Location','Status','Distance(m)','Date','Time','Lat','Lng']];
    records.forEach((r, i) => rows.push([i+1,r.name,r.roll,r.email||'',r.department,r.year+' Year',r.subject,r.location||'',r.status,r.distance,r.marked_at?.split('T')[0],new Date(r.marked_at).toLocaleTimeString(),r.lat,r.lng]));
    dlCSV(rows, 'AttendIQ_All.csv');
  }

  function exportSessCSV(sess, sessRecs) {
    if (!sessRecs.length) { showToast('No records', 'er'); return; }
    const rows = [['#','Name','Roll','Email','Department','Year','Status','Distance(m)','Date','Time','Lat','Lng']];
    sessRecs.forEach((r, i) => rows.push([i+1,r.name,r.roll,r.email||'',r.department,r.year+' Year',r.status,r.distance,r.marked_at?.split('T')[0],new Date(r.marked_at).toLocaleTimeString(),r.lat,r.lng]));
    dlCSV(rows, `AttendIQ_${sess.subject.replace(/\s+/g,'_')}_${sess.date||'session'}.csv`);
  }

  function dlCSV(rows, fname) {
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = fname; a.click(); showToast('CSV exported');
  }

  if (!admin) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)' }}>
      <div style={{ width:'32px', height:'32px', border:'2.5px solid var(--border2)', borderTopColor:'var(--acc)', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>
    </div>
  );

  return (
    <>
      <Head><title>AttendIQ — Dashboard</title></Head>

      {/* ── NAV — glass activates on scroll via CSS class ── */}
      <nav className={`nav-bar${scrolled ? ' scrolled' : ''}`}>
        <div className="nav-inner">
          <div style={S.navLeft}>
            <LogoMark size={22}/>
            <span style={S.navBrand}>AttendIQ</span>
          </div>
          <div style={S.navTabs}>
            {[['sessions','Sessions'],['records','Records']].map(([t,l]) => (
              <button key={t}
                style={{ ...S.navTab, ...(tab === t ? S.navTabOn : {}) }}
                onClick={() => { setTab(t); if (t === 'records') { loadRecords(); loadSessions(); } }}>
                {l}
              </button>
            ))}
          </div>
          <div style={S.navRight}>
            <span style={S.navUser}>{admin.college || admin.username}</span>
            <button style={S.navLogout}
              onClick={async () => { await fetch('/api/auth/logout', { method:'POST' }); router.push('/login'); }}>
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <div style={{ paddingTop:'60px' }}>

        {/* ════════════ SESSIONS TAB ════════════ */}
        {tab === 'sessions' && (
          <div style={S.wrap}>
            <div style={S.pageHeader}>
              <h1 style={S.pageTitle}>Sessions</h1>
              <p style={S.pageSubtitle}>Create GPS-locked QR codes for attendance</p>
            </div>

            <div style={S.twoCol}>
              {/* Generator */}
              <div style={S.card}>
                <div style={S.cardHeader}>
                  <div style={S.cardIconWrap}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2.2" strokeLinecap="round">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    </svg>
                  </div>
                  <div>
                    <div style={S.cardTitle}>Generate QR Code</div>
                    <div style={S.cardSub}>Session data saved to PostgreSQL</div>
                  </div>
                </div>

                <form onSubmit={generateQR}>
                  <FG label="Subject / Class Name *">
                    <Inp value={form.subject} onChange={v => setForm(f=>({...f,subject:v}))} placeholder="e.g. Data Structures & Algorithms" required/>
                  </FG>
                  <FG label="Section / Batch">
                    <Inp value={form.section} onChange={v => setForm(f=>({...f,section:v}))} placeholder="e.g. Section A"/>
                  </FG>
                  <Divider/>
                  <SectionLabel>📍 Classroom Location</SectionLabel>
                  <FG label="Location Name *">
                    <Inp value={form.location} onChange={v => setForm(f=>({...f,location:v}))} placeholder="e.g. Block A – Room 302, 3rd Floor" required/>
                  </FG>
                  <div style={S.r3}>
                    <FG label="Latitude *"><Inp type="number" step="0.000001" value={form.lat} onChange={v=>setForm(f=>({...f,lat:v}))} placeholder="13.082700" required/></FG>
                    <FG label="Longitude *"><Inp type="number" step="0.000001" value={form.lng} onChange={v=>setForm(f=>({...f,lng:v}))} placeholder="80.270700" required/></FG>
                    <FG label="Radius (m)"><Inp type="number" value={form.radius} onChange={v=>setForm(f=>({...f,radius:v}))} min="5" max="500"/></FG>
                  </div>
                  <button type="button" onClick={myLocation} style={S.ghostBtn}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>
                    Use My Location
                  </button>
                  <p style={S.hint}>Indoor GPS is compensated automatically.</p>
                  <Divider/>
                  <div style={S.r2}>
                    <FG label="Date"><Inp type="date" value={form.date} min={todayIST} onChange={v=>setForm(f=>({...f,date:v}))}/></FG>
                    <FG label="Time"><Inp type="time" value={form.timeSlot} onChange={v=>setForm(f=>({...f,timeSlot:v}))}/></FG>
                  </div>
                  <FG label="QR Expires After">
                    <select style={S.select} value={form.expiryMinutes} onChange={e=>setForm(f=>({...f,expiryMinutes:e.target.value}))}>
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="60">1 hour</option>
                      <option value="120">2 hours</option>
                      <option value="0">No expiry</option>
                    </select>
                  </FG>
                  {formErr && <div style={S.formError}>{formErr}</div>}
                  <button type="submit" style={{ ...S.primaryBtn, opacity: submitting ? .65 : 1 }} disabled={submitting}>
                    {submitting
                      ? <div style={S.btnSpinner}/>
                      : <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                          Generate QR Code
                        </>
                    }
                  </button>
                </form>
              </div>

              {/* Right column */}
              <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                {activeQR && (
                  <QRDisplay session={activeQR.session} url={activeQR.url} onDelete={deleteSession}/>
                )}
                <div style={S.card}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                    <span style={S.cardTitle}>Active Sessions</span>
                    <span style={S.countBadge}>{sessions.length}</span>
                  </div>
                  <div style={{ ...S.cardSub, marginBottom:'16px' }}>Click any session to regenerate its QR</div>
                  {sessions.length === 0
                    ? <EmptyState icon="📋" title="No sessions yet" sub="Generate your first QR code above"/>
                    : sessions.map(s => (
                        <SessCard key={s.id} s={s}
                          onClick={() => setActiveQR({ session:s, url:window.location.origin+'/attend?s='+s.id })}
                          onDelete={deleteSession}/>
                      ))
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════ RECORDS TAB ════════════ */}
        {tab === 'records' && (
          <div style={S.wrap}>
            <div style={{ ...S.pageHeader, display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'16px' }}>
              <div>
                <h1 style={S.pageTitle}>Records</h1>
                <p style={S.pageSubtitle}>Each session shown as a separate block</p>
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <GhostBtn onClick={() => { loadRecords(); loadSessions(); showToast('Refreshed'); }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  Refresh
                </GhostBtn>
                <GhostBtn onClick={exportAllCSV}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Export All
                </GhostBtn>
              </div>
            </div>

            {/* Stats */}
            <div style={S.statsRow}>
              {[
                { label:'Total Sessions', val:sessions.length, color:'var(--acc)',  bg:'rgba(0,113,227,0.06)' },
                { label:'Total Present',  val:stats.present,   color:'#248a3d',     bg:'var(--grn-bg)' },
                { label:'Total Absent',   val:stats.absent,    color:'#c41e1e',     bg:'var(--red-bg)' },
              ].map(sc => (
                <div key={sc.label} style={{ ...S.statCard, background: sc.bg }}>
                  <div style={{ fontSize:'32px', fontWeight:700, color:sc.color, letterSpacing:'-1.5px', lineHeight:1 }}>{sc.val}</div>
                  <div style={{ fontSize:'12px', color:'var(--txt3)', marginTop:'5px', fontWeight:500 }}>{sc.label}</div>
                </div>
              ))}
            </div>

            {/* Session record blocks */}
            {sessions.length === 0
              ? <div style={S.card}><EmptyState icon="📊" title="No sessions yet" sub="Create a session first"/></div>
              : sessions.map(sess => {
                  const sessRecs = records.filter(r => r.session_id === sess.id);
                  const present  = sessRecs.filter(r => r.status === 'present').length;
                  const absent   = sessRecs.length - present;
                  const exp      = sess.expires_at && new Date(sess.expires_at) < new Date();

                  return (
                    <div key={sess.id} style={{ ...S.card, marginBottom:'16px' }}>
                      {/* Session header */}
                      <div style={S.sessRecHeader}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'7px' }}>
                            <h3 style={{ fontSize:'17px', fontWeight:700, letterSpacing:'-0.3px' }}>{sess.subject}</h3>
                            {sess.section && <Chip>{sess.section}</Chip>}
                            <Chip color={exp ? 'red' : 'green'}>{exp ? 'Expired' : 'Active'}</Chip>
                          </div>
                          <div style={{ display:'flex', gap:'16px', flexWrap:'wrap' }}>
                            <Meta icon="📍">{sess.location}</Meta>
                            {sess.date && <Meta icon="📅">{sess.date}{sess.time_slot ? ' · '+sess.time_slot : ''}</Meta>}
                            <Meta icon="📡">{sess.radius}m radius</Meta>
                          </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'10px', flexWrap:'wrap' }}>
                          <MiniStat val={sessRecs.length} label="Total"   color="var(--acc)"/>
                          <MiniStat val={present}         label="Present" color="#248a3d"/>
                          <MiniStat val={absent}          label="Absent"  color="#c41e1e"/>
                          <GhostBtn onClick={() => exportSessCSV(sess, sessRecs)}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            CSV
                          </GhostBtn>
                        </div>
                      </div>

                      {sessRecs.length === 0
                        ? <EmptyState icon="📭" title="No submissions yet" sub="Waiting for students to scan"/>
                        : (
                          <div style={S.tableWrap}>
                            <table style={S.table}>
                              <thead>
                                <tr>
                                  {['#','Name','Roll No.','Email','Department','Year','Status','Distance','Time','Map'].map(h => (
                                    <th key={h} style={S.th}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sessRecs.map((r, i) => (
                                  <tr key={r.id} style={{ background: i%2===0 ? 'transparent' : 'rgba(0,0,0,0.014)' }}>
                                    <td style={{ ...S.td, ...S.tdMono, color:'var(--txt4)' }}>{i+1}</td>
                                    <td style={{ ...S.td, fontWeight:600 }}>{r.name}</td>
                                    <td style={{ ...S.td, ...S.tdMono }}>{r.roll}</td>
                                    <td style={{ ...S.td, fontSize:'12px', color:'var(--txt3)' }}>{r.email||'—'}</td>
                                    <td style={{ ...S.td, fontSize:'13px' }}>{r.department}</td>
                                    <td style={S.td}><Chip>{r.year} Yr</Chip></td>
                                    <td style={S.td}><StatusBadge status={r.status}/></td>
                                    <td style={S.td}><span style={S.distPill}>{r.distance}m</span></td>
                                    <td style={{ ...S.td, ...S.tdMono, fontSize:'11px', whiteSpace:'nowrap', color:'var(--txt3)' }}>{new Date(r.marked_at).toLocaleString()}</td>
                                    <td style={S.td}><a href={`https://maps.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer" style={S.mapBtn}>Map</a></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )
                      }
                    </div>
                  );
                })
            }
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, borderColor: toast.type==='er' ? 'rgba(255,59,48,0.2)' : 'rgba(52,199,89,0.2)' }}>
          <div style={{ width:'6px', height:'6px', borderRadius:'50%', background: toast.type==='er' ? 'var(--red)' : 'var(--grn)', flexShrink:0 }}/>
          <span style={{ fontSize:'13px', fontWeight:500, color: toast.type==='er' ? 'var(--red)' : 'var(--txt)' }}>{toast.msg}</span>
        </div>
      )}
    </>
  );
}

// ── QR Display ─────────────────────────────────────────
function QRDisplay({ session, url, onDelete }) {
  const [src, setSrc]       = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    import('qrcode').then(m => {
      const QR = m.default || m;
      QR.toDataURL(url, { width:200, margin:2, color:{ dark:'#1d1d1f', light:'#ffffff' } }).then(setSrc);
    });
  }, [url]);

  return (
    <div style={S.card}>
      <div style={{ ...S.cardTitle, marginBottom:'16px' }}>QR Code Ready</div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'14px' }}>
        {src
          ? <img src={src} alt="QR" style={{ width:'180px', height:'180px', borderRadius:'12px', border:'1px solid var(--border)' }}/>
          : <div style={{ width:'180px', height:'180px', borderRadius:'12px', background:'var(--surface2)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--txt4)', fontSize:'12px' }}>Generating…</div>
        }
        <div style={{ textAlign:'center' }}>
          <div style={{ fontWeight:700, fontSize:'15px', letterSpacing:'-0.3px', marginBottom:'3px' }}>
            {session.subject}{session.section ? ' · ' + session.section : ''}
          </div>
          <div style={{ fontSize:'12px', color:'var(--txt3)' }}>📍 {session.location}{session.date ? ' · ' + session.date : ''}</div>
        </div>
        <div style={S.urlBox}>
          <div style={{ fontSize:'10px', color:'var(--txt4)', marginBottom:'6px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>Student URL</div>
          <div style={{ fontFamily:'var(--mono)', fontSize:'10px', color:'var(--txt3)', wordBreak:'break-all', lineHeight:'1.5' }}>{url}</div>
          <div style={{ display:'flex', gap:'8px', marginTop:'10px', flexWrap:'wrap' }}>
            <GhostBtn onClick={() => navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}>
              {copied ? '✓ Copied' : '📋 Copy URL'}
            </GhostBtn>
            <GhostBtn onClick={() => { const a=document.createElement('a'); a.href=src; a.download='AttendIQ-QR.png'; a.click(); }}>
              ⬇ PNG
            </GhostBtn>
            <GhostBtn onClick={() => onDelete(session.id)} danger>Delete</GhostBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────
function SessCard({ s, onClick, onDelete }) {
  const exp = s.expires_at && new Date(s.expires_at) < new Date();
  return (
    <div style={S.sessItem} onClick={onClick}>
      <div style={{ flex:1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'7px', marginBottom:'4px', flexWrap:'wrap' }}>
          <span style={{ fontWeight:600, fontSize:'14px', letterSpacing:'-0.2px' }}>{s.subject}</span>
          <Chip color={exp ? 'red' : 'green'} size="sm">{exp ? 'Expired' : 'Active'}</Chip>
        </div>
        <div style={{ fontSize:'12px', color:'var(--txt3)', display:'flex', gap:'12px', flexWrap:'wrap' }}>
          <span>📍 {s.location}</span>
          {s.date && <span>📅 {s.date}</span>}
        </div>
        <div style={{ fontSize:'12px', marginTop:'4px' }}>
          <span style={{ color:'#248a3d', fontWeight:500 }}>✅ {s.present_count||0}</span>
          <span style={{ color:'var(--txt4)', margin:'0 4px' }}>·</span>
          <span style={{ color:'#c41e1e', fontWeight:500 }}>❌ {(s.response_count||0)-(s.present_count||0)}</span>
        </div>
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'5px', flexShrink:0, marginLeft:'12px' }}>
        <div style={{ fontSize:'24px', fontWeight:700, color:'var(--acc)', letterSpacing:'-1px', lineHeight:1 }}>{s.response_count||0}</div>
        <div style={{ fontSize:'10px', color:'var(--txt4)', fontWeight:500 }}>responses</div>
        <GhostBtn onClick={e => { e.stopPropagation(); onDelete(s.id); }} danger style={{ fontSize:'12px', padding:'4px 9px' }}>Delete</GhostBtn>
      </div>
    </div>
  );
}

function Chip({ children, color='blue', size='md' }) {
  const C = {
    blue:  { bg:'rgba(0,113,227,0.08)',  color:'#0071e3', border:'rgba(0,113,227,0.15)' },
    green: { bg:'rgba(52,199,89,0.10)',  color:'#248a3d', border:'rgba(52,199,89,0.2)' },
    red:   { bg:'rgba(255,59,48,0.08)',  color:'#c41e1e', border:'rgba(255,59,48,0.15)' },
    gray:  { bg:'rgba(0,0,0,0.05)',      color:'#6e6e73', border:'rgba(0,0,0,0.1)' },
  }[color] || { bg:'rgba(0,113,227,0.08)', color:'#0071e3', border:'rgba(0,113,227,0.15)' };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding: size==='sm' ? '2px 7px' : '3px 10px', borderRadius:'20px', fontSize: size==='sm' ? '11px' : '12px', fontWeight:600, background:C.bg, color:C.color, border:`1px solid ${C.border}` }}>
      {children}
    </span>
  );
}

function Meta({ icon, children }) {
  return <span style={{ fontSize:'12px', color:'var(--txt3)', display:'flex', alignItems:'center', gap:'4px' }}><span>{icon}</span><span>{children}</span></span>;
}

function MiniStat({ val, label, color }) {
  return (
    <div style={{ textAlign:'center', background:'var(--surface2)', borderRadius:'10px', padding:'8px 14px', minWidth:'52px', border:'1px solid var(--border)' }}>
      <div style={{ fontSize:'18px', fontWeight:700, color, letterSpacing:'-0.5px', lineHeight:1 }}>{val}</div>
      <div style={{ fontSize:'10px', color:'var(--txt4)', marginTop:'2px', fontWeight:500 }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  return status === 'present'
    ? <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'3px 10px', borderRadius:'20px', fontSize:'12px', fontWeight:600, background:'var(--grn-bg)', color:'#248a3d', border:'1px solid rgba(52,199,89,0.2)' }}>● Present</span>
    : <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'3px 10px', borderRadius:'20px', fontSize:'12px', fontWeight:600, background:'var(--red-bg)', color:'#c41e1e', border:'1px solid rgba(255,59,48,0.2)' }}>● Absent</span>;
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign:'center', padding:'40px 20px' }}>
      <div style={{ fontSize:'36px', marginBottom:'10px' }}>{icon}</div>
      <div style={{ fontSize:'15px', fontWeight:600, color:'var(--txt2)', marginBottom:'4px' }}>{title}</div>
      <div style={{ fontSize:'13px', color:'var(--txt3)' }}>{sub}</div>
    </div>
  );
}

function LogoMark({ size=22 }) {
  return (
    <div style={{ borderRadius:'7px', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,113,227,0.2)', flexShrink:0 }}>
      <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" fill="#0071e3"/>
        <path d="M7 14h14M14 7l7 7-7 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

function FG({ label, children }) {
  return (
    <div style={{ marginBottom:'14px' }}>
      <label style={{ display:'block', fontSize:'13px', fontWeight:500, color:'var(--txt3)', marginBottom:'6px', letterSpacing:'-0.1px' }}>{label}</label>
      {children}
    </div>
  );
}

function Inp({ onChange, ...p }) { return <input style={S.input} onChange={e => onChange(e.target.value)} {...p}/>; }
function Divider() { return <div style={S.divider}/>; }
function SectionLabel({ children }) { return <div style={S.sectionLabel}>{children}</div>; }
function GhostBtn({ children, onClick, danger, style: extra }) {
  return (
    <button onClick={onClick} style={{ display:'inline-flex', alignItems:'center', gap:'5px', padding:'7px 12px', borderRadius:'8px', fontSize:'13px', fontWeight:500, background:'var(--surface2)', border:'1px solid var(--border)', color: danger ? 'var(--red)' : 'var(--txt2)', cursor:'pointer', ...extra }}>
      {children}
    </button>
  );
}

// ── Styles ──────────────────────────────────────────────
const S = {
  navLeft:    { display:'flex', alignItems:'center', gap:'8px' },
  navBrand:   { fontSize:'16px', fontWeight:600, color:'var(--txt)', letterSpacing:'-0.3px' },
  navTabs:    { display:'flex', gap:'2px', background:'rgba(0,0,0,0.06)', borderRadius:'10px', padding:'3px' },
  navTab:     { padding:'5px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:500, border:'none', background:'transparent', color:'var(--txt3)', cursor:'pointer', transition:'all .2s' },
  navTabOn:   { background:'#fff', color:'var(--txt)', boxShadow:'0 1px 4px rgba(0,0,0,0.1)', fontWeight:600 },
  navRight:   { display:'flex', alignItems:'center', gap:'12px' },
  navUser:    { fontSize:'13px', color:'var(--txt3)', fontWeight:500 },
  navLogout:  { padding:'6px 14px', borderRadius:'8px', fontSize:'13px', fontWeight:500, border:'1px solid var(--border2)', background:'transparent', color:'var(--txt3)', cursor:'pointer' },

  wrap:         { maxWidth:'1200px', margin:'0 auto', padding:'36px 24px 60px' },
  pageHeader:   { marginBottom:'28px' },
  pageTitle:    { fontSize:'28px', fontWeight:700, letterSpacing:'-0.8px', color:'var(--txt)', marginBottom:'4px' },
  pageSubtitle: { fontSize:'15px', color:'var(--txt3)' },

  twoCol: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px', alignItems:'start' },

  card: { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-lg)', padding:'24px', boxShadow:'var(--shadow-sm)' },
  cardHeader: { display:'flex', alignItems:'center', gap:'12px', marginBottom:'22px' },
  cardIconWrap: { width:'36px', height:'36px', borderRadius:'10px', background:'var(--acc-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  cardTitle: { fontSize:'16px', fontWeight:700, color:'var(--txt)', letterSpacing:'-0.3px' },
  cardSub:   { fontSize:'12px', color:'var(--txt3)', marginTop:'1px' },
  countBadge:{ display:'inline-flex', alignItems:'center', justifyContent:'center', background:'var(--acc-light)', color:'var(--acc)', borderRadius:'20px', fontSize:'12px', fontWeight:600, padding:'1px 8px', marginLeft:'6px' },

  divider:      { height:'1px', background:'var(--border)', margin:'18px 0' },
  sectionLabel: { fontSize:'13px', fontWeight:600, color:'var(--txt2)', marginBottom:'14px' },

  input:  { width:'100%', padding:'10px 13px', background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:'10px', fontSize:'14px', color:'var(--txt)', outline:'none', transition:'border-color .2s' },
  select: { width:'100%', padding:'10px 13px', background:'var(--surface2)', border:'1.5px solid var(--border)', borderRadius:'10px', fontSize:'14px', color:'var(--txt)', outline:'none', WebkitAppearance:'none', appearance:'none' },
  r2: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' },
  r3: { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' },

  hint:      { fontSize:'12px', color:'var(--txt4)', marginTop:'7px', lineHeight:'1.5' },
  formError: { background:'var(--red-bg)', border:'1px solid rgba(255,59,48,0.2)', borderRadius:'10px', padding:'10px 14px', color:'var(--red)', fontSize:'13px', fontWeight:500, marginBottom:'14px' },

  primaryBtn: { width:'100%', padding:'12px', borderRadius:'10px', background:'var(--acc)', color:'#fff', fontSize:'15px', fontWeight:600, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'7px', boxShadow:'0 2px 12px rgba(0,113,227,0.25)', letterSpacing:'-0.2px' },
  btnSpinner: { width:'16px', height:'16px', border:'2px solid rgba(255,255,255,.35)', borderTopColor:'#fff', borderRadius:'50%', animation:'spin .6s linear infinite' },

  urlBox: { background:'var(--surface2)', borderRadius:'10px', padding:'12px', width:'100%', border:'1px solid var(--border)' },

  sessItem: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'14px 16px', borderRadius:'var(--r)', border:'1px solid var(--border)', cursor:'pointer', marginBottom:'8px', background:'var(--surface)', transition:'box-shadow .2s', boxShadow:'var(--shadow-xs)' },

  statsRow: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px', marginBottom:'24px' },
  statCard: { borderRadius:'var(--r-lg)', padding:'20px', border:'1px solid var(--border)' },

  sessRecHeader: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'14px', marginBottom:'18px', paddingBottom:'16px', borderBottom:'1px solid var(--border)' },

  tableWrap: { overflowX:'auto', borderRadius:'10px', border:'1px solid var(--border)' },
  table:     { width:'100%', borderCollapse:'collapse', fontSize:'13px' },
  th:        { padding:'10px 13px', textAlign:'left', fontSize:'11px', fontWeight:600, color:'var(--txt3)', textTransform:'uppercase', letterSpacing:'0.4px', background:'var(--surface2)', whiteSpace:'nowrap', borderBottom:'1px solid var(--border)' },
  td:        { padding:'11px 13px', borderTop:'1px solid var(--border)' },
  tdMono:    { fontFamily:'var(--mono)', fontSize:'11px' },
  distPill:  { fontFamily:'var(--mono)', fontSize:'11px', padding:'2px 8px', borderRadius:'5px', background:'var(--surface2)', border:'1px solid var(--border)', color:'var(--txt2)' },
  mapBtn:    { display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:'6px', fontSize:'12px', fontWeight:500, background:'var(--acc-light)', color:'var(--acc)', border:'1px solid var(--acc-mid)' },

  toast: { position:'fixed', bottom:'20px', right:'20px', zIndex:9999, display:'flex', alignItems:'center', gap:'10px', padding:'11px 16px', borderRadius:'12px', border:'1px solid', background:'rgba(255,255,255,0.95)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', boxShadow:'var(--shadow-lg)', animation:'toastIn .3s cubic-bezier(0.34,1.56,0.64,1)', maxWidth:'300px' },
};
