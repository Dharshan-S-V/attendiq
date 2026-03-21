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
  const [form, setForm]             = useState({ subject:'', section:'', location:'', lat:'', lng:'', radius:'50', date:'', timeSlot:'', expiryMinutes:'30' });
  const [formErr, setFormErr]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]           = useState(null);

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
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          subject: form.subject, section: form.section, location: form.location,
          lat: parseFloat(form.lat), lng: parseFloat(form.lng),
          radius: parseInt(form.radius)||50,
          date: form.date, timeSlot: form.timeSlot,
          expiryMinutes: parseInt(form.expiryMinutes)
        })
      });
      const d = await r.json();
      if (!r.ok) { setFormErr(d.error); return; }
      setActiveQR({ session: d.session, url: window.location.origin + '/attend?s=' + d.session.id });
      loadSessions(); showToast('QR code generated!');
    } catch { setFormErr('Network error. Try again.'); }
    finally { setSubmitting(false); }
  }

  async function deleteSession(id) {
    if (!confirm('Delete session? Records kept.')) return;
    await fetch('/api/sessions/' + id, { method:'DELETE' });
    if (activeQR?.session?.id === id) setActiveQR(null);
    loadSessions(); showToast('Session deleted');
  }

  function myLocation() {
    navigator.geolocation?.getCurrentPosition(
      p => { setForm(f => ({ ...f, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) })); showToast('Location set'); },
      e => showToast('GPS error: ' + e.message, 'er'),
      { enableHighAccuracy: true }
    );
  }

  function showToast(msg, type='ok') { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }

  function exportAllCSV() {
    if (!records.length) { showToast('No records to export', 'er'); return; }
    const rows = [['#','Name','Roll','Email','Department','Year','Subject','Location','Status','Distance(m)','GPS Accuracy(m)','Date','Time','Lat','Lng']];
    records.forEach((r,i) => rows.push([
      i+1, r.name, r.roll, r.email||'', r.department, r.year+' Year',
      r.subject, r.location||'', r.status, r.distance, r.accuracy,
      r.marked_at?.split('T')[0], new Date(r.marked_at).toLocaleTimeString(),
      r.lat, r.lng
    ]));
    dlCSV(rows, 'AttendIQ_All_Records.csv');
  }

  function exportSessCSV(sess, sessRecs) {
    if (!sessRecs.length) { showToast('No records for this session', 'er'); return; }
    const rows = [['#','Name','Roll','Email','Department','Year','Status','Distance(m)','GPS Accuracy(m)','Date','Time','Lat','Lng']];
    sessRecs.forEach((r,i) => rows.push([
      i+1, r.name, r.roll, r.email||'', r.department, r.year+' Year',
      r.status, r.distance, r.accuracy,
      r.marked_at?.split('T')[0], new Date(r.marked_at).toLocaleTimeString(),
      r.lat, r.lng
    ]));
    dlCSV(rows, 'AttendIQ_' + sess.subject.replace(/\s+/g,'_') + '_' + (sess.date||'nodate') + '.csv');
  }

  function dlCSV(rows, fname) {
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = fname; a.click();
    showToast('CSV exported!');
  }

  if (!admin) return <Centered><Spin /></Centered>;

  return (
    <>
      <Head><title>AttendIQ — Dashboard</title></Head>

      {/* ── NAV ── */}
      <nav style={S.nav}>
        <div style={S.brand}><div style={S.dot}/>AttendIQ</div>
        <div style={{display:'flex',gap:'3px'}}>
          {[['sessions','⚙ Sessions'],['records','📊 Records']].map(([t,l])=>(
            <button key={t} style={{...S.np,...(tab===t?S.npOn:{})}}
              onClick={()=>{ setTab(t); if(t==='records'){loadRecords();loadSessions();} }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <span style={{fontSize:'13px',color:'var(--m2)'}}>{admin.college||admin.username}</span>
          <button style={S.logoutBtn} onClick={async()=>{await fetch('/api/auth/logout',{method:'POST'});router.push('/login');}}>
            Logout
          </button>
        </div>
      </nav>

      <div style={{position:'relative',zIndex:1,paddingTop:'60px'}}>

        {/* ════════════════ SESSIONS TAB ════════════════ */}
        {tab==='sessions' && (
          <div style={S.wrap}>
            <div style={S.sh}><h2 style={S.h2}>Session Manager</h2><p style={S.shp}>Create GPS-locked QR codes for attendance</p></div>
            <div style={S.grid2}>

              {/* Generator form */}
              <div style={S.card}>
                <div style={S.ch}>Generate Attendance QR</div>
                <div style={S.cs}>Session saved to PostgreSQL — works across all devices</div>
                <form onSubmit={generateQR}>
                  <FG label="Subject / Class Name *">
                    <Inp value={form.subject} onChange={v=>setForm(f=>({...f,subject:v}))} placeholder="e.g. Data Structures & Algorithms" required/>
                  </FG>
                  <FG label="Section / Batch">
                    <Inp value={form.section} onChange={v=>setForm(f=>({...f,section:v}))} placeholder="e.g. Section A  |  Batch 2021-25"/>
                  </FG>
                  <div style={S.dv}/>
                  <div style={{fontSize:'13px',fontWeight:700,marginBottom:'13px'}}>📍 Classroom Location</div>
                  <FG label="Location Name *">
                    <Inp value={form.location} onChange={v=>setForm(f=>({...f,location:v}))} placeholder="e.g. Block A - Room 302, 3rd Floor" required/>
                  </FG>
                  <div style={S.r3}>
                    <FG label="Latitude *">
                      <Inp type="number" step="0.000001" value={form.lat} onChange={v=>setForm(f=>({...f,lat:v}))} placeholder="13.082700" required/>
                    </FG>
                    <FG label="Longitude *">
                      <Inp type="number" step="0.000001" value={form.lng} onChange={v=>setForm(f=>({...f,lng:v}))} placeholder="80.270700" required/>
                    </FG>
                    <FG label="Radius (m)">
                      <Inp type="number" value={form.radius} onChange={v=>setForm(f=>({...f,radius:v}))} min="5" max="500"/>
                    </FG>
                  </div>
                  <button type="button" onClick={myLocation} style={S.smBtn}>📍 Use My Location</button>
                  <p style={S.hint}>💡 Upper floors: use building lat/lng. GPS buffer added automatically.</p>
                  <div style={S.dv}/>
                  <div style={S.r2}>
                    <FG label="Date"><Inp type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))}/></FG>
                    <FG label="Time Slot"><Inp type="time" value={form.timeSlot} onChange={v=>setForm(f=>({...f,timeSlot:v}))}/></FG>
                  </div>
                  <FG label="QR Expires After">
                    <select style={S.inp} value={form.expiryMinutes} onChange={e=>setForm(f=>({...f,expiryMinutes:e.target.value}))}>
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="60">1 hour</option>
                      <option value="120">2 hours</option>
                      <option value="0">No expiry</option>
                    </select>
                  </FG>
                  {formErr && <div style={S.errBox}>{formErr}</div>}
                  <button type="submit" style={{...S.btnP,opacity:submitting?0.7:1}} disabled={submitting}>
                    {submitting?'Generating…':'⚡ Generate QR Code'}
                  </button>
                </form>
              </div>

              {/* QR preview + sessions list */}
              <div>
                {activeQR && (
                  <div style={S.card}>
                    <div style={S.ch}>QR Code Ready ✅</div>
                    <div style={S.cs}>Students scan with phone camera — form opens in browser</div>
                    <QRDisplay session={activeQR.session} url={activeQR.url} onDelete={deleteSession}/>
                  </div>
                )}
                <div style={{...S.card, marginTop: activeQR ? '16px' : '0'}}>
                  <div style={S.ch}>Sessions <span style={{fontSize:'12px',color:'var(--mut)',fontWeight:400}}>({sessions.length})</span></div>
                  <div style={{fontSize:'12px',color:'var(--mut)',marginBottom:'13px'}}>Click to regenerate QR</div>
                  {sessions.length===0
                    ? <Empty icon="📋" text="No sessions yet"/>
                    : sessions.map(s=>(
                        <SessItem key={s.id} s={s}
                          onClick={()=>setActiveQR({session:s, url:window.location.origin+'/attend?s='+s.id})}
                          onDelete={deleteSession}/>
                      ))
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ RECORDS TAB ════════════════ */}
        {tab==='records' && (
          <div style={S.wrap}>

            {/* Header */}
            <div style={{...S.sh, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'12px'}}>
              <div>
                <h2 style={S.h2}>Attendance Records</h2>
                <p style={S.shp}>Each session has its own separate record block</p>
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <button style={S.smBtn} onClick={exportAllCSV}>⬇ Export All CSV</button>
                <button style={S.smBtn} onClick={()=>{loadRecords();loadSessions();showToast('Refreshed');}}>↻ Refresh</button>
              </div>
            </div>

            {/* Overall stats */}
            <div style={S.statsGrid}>
              {[
                ['Total Sessions', sessions.length, 'rgba(59,130,246,.3)', 'var(--acc)'],
                ['Total Present',  stats.present,   'rgba(34,197,94,.3)',  'var(--grn)'],
                ['Total Absent',   stats.absent,    'rgba(239,68,68,.3)',  'var(--red)'],
              ].map(([l,v,bc,vc])=>(
                <div key={l} style={{...S.sc, borderColor:bc}}>
                  <div style={{fontSize:'28px',fontWeight:800,color:vc,letterSpacing:'-1px'}}>{v}</div>
                  <div style={{fontSize:'11px',color:'var(--mut)',marginTop:'3px'}}>{l}</div>
                </div>
              ))}
            </div>

            {/* ── One card per session ── */}
            {sessions.length === 0
              ? <div style={S.card}><Empty icon="📋" text="No sessions yet. Create one in the Sessions tab."/></div>
              : sessions.map(sess => {
                  const sessRecs = records.filter(r => r.session_id === sess.id);
                  const present  = sessRecs.filter(r => r.status === 'present').length;
                  const absent   = sessRecs.length - present;
                  const exp      = sess.expires_at && new Date(sess.expires_at) < new Date();

                  return (
                    <div key={sess.id} style={{...S.card, marginBottom:'20px'}}>

                      {/* Session header block */}
                      <div style={{
                        background:'var(--s2)', borderRadius:'10px', padding:'14px 18px',
                        marginBottom:'18px', borderLeft:'3px solid var(--acc)'
                      }}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:'10px'}}>
                          <div>
                            <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap',marginBottom:'6px'}}>
                              <span style={{fontSize:'16px',fontWeight:800}}>{sess.subject}</span>
                              {sess.section && <span style={S.bb2}>{sess.section}</span>}
                              <span style={exp ? S.bdgR : S.bdgG}>{exp ? 'Expired' : 'Active'}</span>
                            </div>
                            <div style={{fontSize:'12px',color:'var(--m2)',display:'flex',gap:'16px',flexWrap:'wrap'}}>
                              <span>📍 {sess.location}</span>
                              {sess.date && <span>📅 {sess.date}{sess.time_slot ? ' · '+sess.time_slot : ''}</span>}
                              <span>📡 {sess.radius}m radius</span>
                            </div>
                          </div>

                          {/* Mini stat pills + CSV button */}
                          <div style={{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap'}}>
                            <div style={S.miniStat}>
                              <span style={{fontSize:'18px',fontWeight:800,color:'var(--acc)'}}>{sessRecs.length}</span>
                              <span style={{fontSize:'10px',color:'var(--mut)'}}>Total</span>
                            </div>
                            <div style={{...S.miniStat,borderColor:'rgba(34,197,94,.3)'}}>
                              <span style={{fontSize:'18px',fontWeight:800,color:'var(--grn)'}}>{present}</span>
                              <span style={{fontSize:'10px',color:'var(--mut)'}}>Present</span>
                            </div>
                            <div style={{...S.miniStat,borderColor:'rgba(239,68,68,.3)'}}>
                              <span style={{fontSize:'18px',fontWeight:800,color:'var(--red)'}}>{absent}</span>
                              <span style={{fontSize:'10px',color:'var(--mut)'}}>Absent</span>
                            </div>
                            <button style={S.smBtn} onClick={()=>exportSessCSV(sess,sessRecs)}>
                              ⬇ CSV
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Records table */}
                      {sessRecs.length === 0
                        ? <Empty icon="📭" text="No submissions yet for this session"/>
                        : (
                          <div style={S.twrap}>
                            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}>
                              <thead>
                                <tr>
                                  {['#','Name','Roll No.','Email','Department','Year','Status','Distance','Time','Map'].map(h=>(
                                    <th key={h} style={S.th}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sessRecs.map((r,i) => (
                                  <tr key={r.id} style={{
                                    background: i%2===0 ? 'transparent' : 'rgba(255,255,255,0.018)',
                                    borderBottom: '1px solid var(--bor)'
                                  }}>
                                    <td style={{...S.td,...S.mono,color:'var(--mut)'}}>{i+1}</td>
                                    <td style={{...S.td,fontWeight:700}}>{r.name}</td>
                                    <td style={{...S.td,...S.mono}}>{r.roll}</td>
                                    <td style={{...S.td,fontSize:'12px',color:'var(--m2)'}}>{r.email||'—'}</td>
                                    <td style={{...S.td,fontSize:'12px'}}>{r.department}</td>
                                    <td style={S.td}><span style={S.bb2}>{r.year} Yr</span></td>
                                    <td style={S.td}>
                                      <span style={r.status==='present' ? S.bdgG : S.bdgR}>
                                        {r.status==='present' ? '✅' : '❌'} {r.status}
                                      </span>
                                    </td>
                                    <td style={S.td}><span style={S.rpill}>{r.distance}m</span></td>
                                    <td style={{...S.td,...S.mono,whiteSpace:'nowrap',fontSize:'10px'}}>
                                      {new Date(r.marked_at).toLocaleString()}
                                    </td>
                                    <td style={S.td}>
                                      <a href={`https://maps.google.com/maps?q=${r.lat},${r.lng}`}
                                        target="_blank" rel="noreferrer" style={S.ml}>🗺</a>
                                    </td>
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

      {toast && (
        <div style={{...S.toast, borderColor: toast.type==='er' ? 'rgba(239,68,68,.4)' : 'rgba(34,197,94,.4)'}}>
          {toast.type==='er' ? '❌' : '✅'} {toast.msg}
        </div>
      )}
    </>
  );
}

// ── QR Display ─────────────────────────────────────────────
function QRDisplay({ session, url, onDelete }) {
  const [src, setSrc]       = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    import('qrcode').then(m => {
      const QR = m.default || m;
      QR.toDataURL(url, { width:220, margin:1, color:{dark:'#e2e8f0',light:'#111827'} }).then(setSrc);
    });
  }, [url]);

  function copy() { navigator.clipboard.writeText(url).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); }); }
  function dl()   { const a=document.createElement('a'); a.href=src; a.download='AttendIQ-QR.png'; a.click(); }

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'14px',marginTop:'4px'}}>
      {src
        ? <img src={src} alt="QR" style={{borderRadius:'8px',width:'200px',height:'200px'}}/>
        : <div style={{width:'200px',height:'200px',background:'var(--s3)',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--mut)',fontSize:'12px'}}>Generating…</div>
      }
      <div style={{textAlign:'center'}}>
        <strong style={{display:'block',fontSize:'14px',fontWeight:700}}>{session.subject}{session.section?' · '+session.section:''}</strong>
        <span style={{fontSize:'12px',color:'var(--m2)'}}>📍 {session.location}{session.date?' · '+session.date:''}</span>
      </div>
      <div style={{background:'var(--s3)',border:'1px solid var(--bor)',borderRadius:'10px',padding:'12px 14px',width:'100%'}}>
        <div style={{fontSize:'10px',color:'var(--mut)',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:'5px'}}>Student URL</div>
        <div style={{fontFamily:'var(--mono)',fontSize:'10px',color:'var(--m2)',wordBreak:'break-all',lineHeight:'1.5'}}>{url}</div>
        <div style={{display:'flex',gap:'8px',marginTop:'10px',flexWrap:'wrap'}}>
          <button style={S.smBtn} onClick={copy}>{copied?'Copied!':'📋 Copy URL'}</button>
          <button style={S.smBtn} onClick={dl}>⬇ PNG</button>
          <button style={{...S.smBtn,color:'var(--red)',borderColor:'rgba(239,68,68,.3)'}} onClick={()=>onDelete(session.id)}>🗑 Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Session list item ───────────────────────────────────────
function SessItem({ s, onClick, onDelete }) {
  const exp = s.expires_at && new Date(s.expires_at) < new Date();
  return (
    <div style={{background:'var(--s2)',border:'1px solid var(--bor)',borderRadius:'12px',padding:'13px 16px',display:'flex',justifyContent:'space-between',alignItems:'flex-start',cursor:'pointer',marginBottom:'9px'}} onClick={onClick}>
      <div style={{flex:1}}>
        <div style={{fontSize:'13px',fontWeight:700,marginBottom:'3px'}}>
          {s.subject} <span style={{...(exp?S.bdgR:S.bdgG),fontSize:'9px',padding:'2px 7px'}}>{exp?'Expired':'Active'}</span>
        </div>
        <div style={{fontSize:'11px',color:'var(--m2)'}}>📍 {s.location} · <span style={S.rpill}>{s.radius}m</span></div>
        <div style={{fontSize:'11px',color:'var(--m2)',marginTop:'2px'}}>{s.date||''}{s.time_slot?' · '+s.time_slot:''}</div>
        <div style={{fontSize:'11px',marginTop:'3px'}}>
          <span style={{color:'var(--grn)'}}>✅ {s.present_count||0} present</span>
          {' · '}
          <span style={{color:'var(--red)'}}>❌ {(s.response_count||0)-(s.present_count||0)} absent</span>
        </div>
      </div>
      <div style={{textAlign:'right',flexShrink:0,marginLeft:'12px'}}>
        <div style={{fontSize:'22px',fontWeight:800,color:'var(--acc)',lineHeight:1}}>{s.response_count||0}</div>
        <div style={{fontSize:'10px',color:'var(--mut)'}}>total</div>
        <button style={{...S.smBtn,fontSize:'11px',marginTop:'6px',color:'var(--red)',borderColor:'rgba(239,68,68,.25)',padding:'4px 9px'}}
          onClick={e=>{e.stopPropagation();onDelete(s.id);}}>🗑</button>
      </div>
    </div>
  );
}

// ── Shared helpers ──────────────────────────────────────────
function FG({ label, children }) {
  return (
    <div style={{marginBottom:'16px'}}>
      <label style={{display:'block',fontSize:'11px',fontWeight:700,color:'var(--mut)',textTransform:'uppercase',letterSpacing:'.55px',marginBottom:'7px'}}>{label}</label>
      {children}
    </div>
  );
}
function Inp({ onChange, ...p }) { return <input style={S.inp} onChange={e=>onChange(e.target.value)} {...p}/>; }
function Empty({ icon, text })   { return <div style={{textAlign:'center',padding:'36px',color:'var(--mut)'}}><div style={{fontSize:'32px',marginBottom:'9px'}}>{icon}</div><p style={{fontSize:'13px'}}>{text}</p></div>; }
function Centered({ children })  { return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',position:'relative',zIndex:1}}>{children}</div>; }
function Spin()                  { return <div style={{width:'32px',height:'32px',border:'3px solid var(--bor)',borderTopColor:'var(--acc)',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>; }

// ── Styles ──────────────────────────────────────────────────
const S = {
  nav:      { position:'fixed',top:0,left:0,right:0,zIndex:200,height:'60px',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',background:'rgba(4,7,15,.92)',backdropFilter:'blur(16px)',borderBottom:'1px solid var(--bor)' },
  brand:    { fontWeight:800,fontSize:'17px',display:'flex',alignItems:'center',gap:'8px' },
  dot:      { width:'8px',height:'8px',borderRadius:'50%',background:'var(--acc)',boxShadow:'0 0 10px var(--acc)',animation:'blink 2s infinite' },
  np:       { padding:'6px 13px',borderRadius:'8px',fontSize:'13px',fontWeight:600,border:'none',background:'transparent',color:'var(--mut)',cursor:'pointer' },
  npOn:     { background:'var(--s2)',color:'var(--acc)' },
  logoutBtn:{ padding:'6px 14px',borderRadius:'8px',fontSize:'13px',fontWeight:600,border:'1px solid var(--bor)',background:'transparent',color:'var(--mut)',cursor:'pointer' },
  wrap:     { maxWidth:'1100px',margin:'0 auto',padding:'32px 20px 60px' },
  sh:       { marginBottom:'24px' },
  h2:       { fontSize:'23px',fontWeight:800,letterSpacing:'-.5px' },
  shp:      { color:'var(--m2)',fontSize:'13px',marginTop:'5px' },
  card:     { background:'var(--sur)',border:'1px solid var(--bor)',borderRadius:'14px',padding:'24px' },
  ch:       { fontSize:'16px',fontWeight:700,marginBottom:'4px' },
  cs:       { fontSize:'12px',color:'var(--mut)',marginBottom:'18px' },
  dv:       { height:'1px',background:'var(--bor)',margin:'18px 0' },
  hint:     { fontSize:'11px',color:'var(--mut)',marginTop:'6px',lineHeight:'1.55' },
  errBox:   { background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:'8px',padding:'10px 14px',color:'var(--red)',fontSize:'13px',marginBottom:'16px' },
  btnP:     { width:'100%',padding:'13px',borderRadius:'10px',background:'var(--acc)',color:'#fff',fontSize:'15px',fontWeight:700,border:'none',cursor:'pointer' },
  smBtn:    { padding:'7px 12px',borderRadius:'7px',fontSize:'12px',fontWeight:600,background:'var(--s2)',border:'1px solid var(--bor)',color:'var(--m2)',cursor:'pointer' },
  inp:      { width:'100%',padding:'11px 14px',background:'var(--s2)',border:'1px solid var(--bor)',borderRadius:'10px',color:'var(--txt)',fontFamily:'var(--fnt)',fontSize:'14px',outline:'none' },
  r2:       { display:'grid',gridTemplateColumns:'1fr 1fr',gap:'13px' },
  r3:       { display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'13px' },
  grid2:    { display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px' },
  statsGrid:{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'13px',marginBottom:'22px' },
  sc:       { background:'var(--sur)',border:'1px solid',borderRadius:'12px',padding:'17px' },
  miniStat: { display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:'var(--s2)',border:'1px solid var(--bor)',borderRadius:'10px',padding:'8px 14px',minWidth:'56px' },
  twrap:    { overflowX:'auto',borderRadius:'12px',border:'1px solid var(--bor)' },
  th:       { padding:'11px 13px',textAlign:'left',fontWeight:700,color:'var(--mut)',fontSize:'10px',textTransform:'uppercase',letterSpacing:'.5px',whiteSpace:'nowrap',background:'var(--s2)',borderBottom:'1px solid var(--bor)' },
  td:       { padding:'11px 13px',borderTop:'1px solid var(--bor)' },
  mono:     { fontFamily:'var(--mono)',fontSize:'11px' },
  rpill:    { fontFamily:'var(--mono)',fontSize:'11px',padding:'2px 7px',borderRadius:'4px',background:'var(--s3)' },
  bdgG:     { display:'inline-flex',alignItems:'center',gap:'4px',padding:'3px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:700,background:'rgba(34,197,94,.12)',color:'var(--grn)',border:'1px solid rgba(34,197,94,.25)' },
  bdgR:     { display:'inline-flex',alignItems:'center',gap:'4px',padding:'3px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:700,background:'rgba(239,68,68,.12)',color:'var(--red)',border:'1px solid rgba(239,68,68,.25)' },
  bb2:      { display:'inline-flex',alignItems:'center',gap:'4px',padding:'3px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:700,background:'rgba(59,130,246,.12)',color:'var(--acc)',border:'1px solid rgba(59,130,246,.25)' },
  ml:       { display:'inline-flex',alignItems:'center',color:'var(--acc)',fontSize:'12px',padding:'3px 9px',borderRadius:'6px',background:'rgba(59,130,246,.1)',border:'1px solid rgba(59,130,246,.2)' },
  toast:    { position:'fixed',bottom:'18px',right:'18px',zIndex:9999,padding:'11px 16px',borderRadius:'10px',background:'var(--s2)',border:'1px solid',fontSize:'13px',fontWeight:600,animation:'slideIn .3s ease',boxShadow:'0 8px 30px rgba(0,0,0,.45)' },
};
