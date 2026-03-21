// pages/admin.js
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

const ALL_DEPTS = [
  'CSE-A','CSE-B','CSE-C','AIDS','AIML','CSBS','IT',
  'EEE','ECE-A','ECE-B','CHEMICAL','BME','CIVIL','MECHANICAL'
];

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
  const [filterStatus, setFS]       = useState('');
  const [filterDept, setFD]         = useState('');
  const [filterYear, setFY]         = useState('');
  const [search, setSearch]         = useState('');
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
      p => { setForm(f => ({ ...f, lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) })); showToast('Location set ✓'); },
      e => showToast('GPS error: ' + e.message, 'er'),
      { enableHighAccuracy: true }
    );
  }

  function showToast(msg, type='ok') { setToast({ msg, type }); setTimeout(() => setToast(null), 3200); }

  function exportCSV() {
    const rows = [['#','Name','Roll','Email','Department','Year','Subject','Status','Distance(m)','GPS Accuracy(m)','Date','Time','Lat','Lng']];
    filtered.forEach((r,i) => rows.push([
      i+1, r.name, r.roll, r.email||'',
      r.department, r.year+' Year', r.subject, r.status,
      r.distance, r.accuracy,
      r.marked_at?.split('T')[0], new Date(r.marked_at).toLocaleTimeString(),
      r.lat, r.lng
    ]));
    const csv = rows.map(r => r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = 'AttendIQ_Records.csv'; a.click();
    showToast('CSV exported!');
  }

  const allDepts = [...new Set(records.map(r=>r.department).filter(Boolean))].sort();
  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    return (!q || [r.name, r.roll, r.email, r.department, r.subject].some(v=>v&&v.toLowerCase().includes(q)))
      && (!filterStatus || r.status===filterStatus)
      && (!filterDept   || r.department===filterDept)
      && (!filterYear   || r.year===filterYear);
  });

  if (!admin) return <Centered><Spin /></Centered>;

  return (
    <>
      <Head><title>AttendIQ — Dashboard</title></Head>

      {/* NAV */}
      <nav style={S.nav}>
        <div style={S.brand}><div style={S.dot}/>AttendIQ</div>
        <div style={{display:'flex',gap:'3px'}}>
          {[['sessions','⚙ Sessions'],['records','📊 Records']].map(([t,l])=>(
            <button key={t} style={{...S.np,...(tab===t?S.npOn:{})}}
              onClick={()=>{setTab(t);if(t==='records')loadRecords();}}>{l}</button>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <span style={{fontSize:'13px',color:'var(--m2)'}}>{admin.college||admin.username}</span>
          <button style={S.logoutBtn} onClick={async()=>{await fetch('/api/auth/logout',{method:'POST'});router.push('/login');}}>Logout</button>
        </div>
      </nav>

      <div style={{position:'relative',zIndex:1,paddingTop:'60px'}}>

        {/* ════ SESSIONS ════ */}
        {tab==='sessions' && (
          <div style={S.wrap}>
            <div style={S.sh}><h2 style={S.h2}>Session Manager</h2><p style={S.shp}>Create GPS-locked QR codes for attendance</p></div>
            <div style={S.grid2}>
              <div style={S.card}>
                <div style={S.ch}>Generate Attendance QR</div>
                <div style={S.cs}>Session saved to PostgreSQL — works across all devices</div>
                <form onSubmit={generateQR}>
                  <FG label="Subject / Class Name *"><Inp value={form.subject} onChange={v=>setForm(f=>({...f,subject:v}))} placeholder="e.g. Data Structures & Algorithms" required/></FG>
                  <FG label="Section / Batch"><Inp value={form.section} onChange={v=>setForm(f=>({...f,section:v}))} placeholder="e.g. Section A  |  Batch 2021–25"/></FG>
                  <div style={S.dv}/>
                  <div style={{fontSize:'13px',fontWeight:700,marginBottom:'13px'}}>📍 Classroom Location</div>
                  <FG label="Location Name *"><Inp value={form.location} onChange={v=>setForm(f=>({...f,location:v}))} placeholder="e.g. Block A – Room 302, 3rd Floor" required/></FG>
                  <div style={S.r3}>
                    <FG label="Latitude *"><Inp type="number" step="0.000001" value={form.lat} onChange={v=>setForm(f=>({...f,lat:v}))} placeholder="13.082700" required/></FG>
                    <FG label="Longitude *"><Inp type="number" step="0.000001" value={form.lng} onChange={v=>setForm(f=>({...f,lng:v}))} placeholder="80.270700" required/></FG>
                    <FG label="Radius (m)"><Inp type="number" value={form.radius} onChange={v=>setForm(f=>({...f,radius:v}))} min="5" max="500"/></FG>
                  </div>
                  <button type="button" onClick={myLocation} style={S.smBtn}>📍 Use My Location</button>
                  <p style={S.hint}>💡 Upper floors: use building's lat/lng. The system adds GPS accuracy buffer automatically — no need to inflate the radius.</p>
                  <div style={S.dv}/>
                  <div style={S.r2}>
                    <FG label="Date"><Inp type="date" value={form.date} onChange={v=>setForm(f=>({...f,date:v}))}/></FG>
                    <FG label="Time Slot"><Inp type="time" value={form.timeSlot} onChange={v=>setForm(f=>({...f,timeSlot:v}))}/></FG>
                  </div>
                  <FG label="QR Expires After">
                    <select style={S.inp} value={form.expiryMinutes} onChange={e=>setForm(f=>({...f,expiryMinutes:e.target.value}))}>
                      <option value="15">15 minutes</option><option value="30">30 minutes</option>
                      <option value="60">1 hour</option><option value="120">2 hours</option><option value="0">No expiry</option>
                    </select>
                  </FG>
                  {formErr && <div style={S.errBox}>{formErr}</div>}
                  <button type="submit" style={{...S.btnP,opacity:submitting?.7:1}} disabled={submitting}>
                    {submitting?'⏳ Generating…':'⚡ Generate QR Code'}
                  </button>
                </form>
              </div>

              <div>
                {activeQR && (
                  <div style={S.card}>
                    <div style={S.ch}>QR Code Ready ✅</div>
                    <div style={S.cs}>Students scan → browser opens → fill details → GPS verified → saved to DB</div>
                    <QRDisplay session={activeQR.session} url={activeQR.url} onDelete={deleteSession}/>
                  </div>
                )}
                <div style={{...S.card,marginTop:activeQR?'16px':'0'}}>
                  <div style={S.ch}>Sessions <span style={{fontSize:'12px',color:'var(--mut)',fontWeight:400}}>({sessions.length})</span></div>
                  <div style={{fontSize:'12px',color:'var(--mut)',marginBottom:'13px'}}>Click to regenerate QR</div>
                  {sessions.length===0
                    ? <Empty icon="📋" text="No sessions yet"/>
                    : sessions.map(s=>(
                        <SessItem key={s.id} s={s}
                          onClick={()=>setActiveQR({session:s,url:window.location.origin+'/attend?s='+s.id})}
                          onDelete={deleteSession}/>
                      ))
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ RECORDS ════ */}
        {tab==='records' && (
          <div style={S.wrap}>
            <div style={S.sh}><h2 style={S.h2}>Attendance Records</h2><p style={S.shp}>Stored in PostgreSQL — persistent across all devices</p></div>

            {/* Stats — no Rate */}
            <div style={S.statsGrid}>
              {[
                ['Total',   stats.total,   'rgba(59,130,246,.3)', 'var(--acc)'],
                ['Present', stats.present, 'rgba(34,197,94,.3)',  'var(--grn)'],
                ['Absent',  stats.absent,  'rgba(239,68,68,.3)',  'var(--red)'],
              ].map(([l,v,bc,vc])=>(
                <div key={l} style={{...S.sc,borderColor:bc}}>
                  <div style={{fontSize:'28px',fontWeight:800,color:vc,letterSpacing:'-1px'}}>{v}</div>
                  <div style={{fontSize:'11px',color:'var(--mut)',marginTop:'3px'}}>{l}</div>
                </div>
              ))}
            </div>

            <div style={S.card}>
              <div style={S.fbar}>
                <input style={{...S.finp,maxWidth:'200px'}} placeholder="🔍 Name, roll, email…"
                  value={search} onChange={e=>setSearch(e.target.value)}/>
                <select style={S.fsel} value={filterStatus} onChange={e=>setFS(e.target.value)}>
                  <option value="">All Status</option><option value="present">Present</option><option value="absent">Absent</option>
                </select>
                <select style={S.fsel} value={filterDept} onChange={e=>setFD(e.target.value)}>
                  <option value="">All Departments</option>
                  {allDepts.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
                <select style={S.fsel} value={filterYear} onChange={e=>setFY(e.target.value)}>
                  <option value="">All Years</option>
                  {['I','II','III','IV'].map(y=><option key={y} value={y}>{y} Year</option>)}
                </select>
                <button style={S.smBtn} onClick={exportCSV}>⬇ CSV</button>
                <button style={S.smBtn} onClick={()=>{loadRecords();showToast('Refreshed');}}>↻ Refresh</button>
              </div>

              <div style={S.twrap}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px'}}>
                  <thead>
                    <tr>
                      {['#','Name','Roll','Email','Dept','Year','Subject','Status','Distance','Time','Map'].map(h=>(
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length===0
                      ? <tr><td colSpan={11}><Empty icon="📭" text="No records found"/></td></tr>
                      : filtered.map((r,i)=>(
                          <tr key={r.id}>
                            <td style={{...S.td,...S.mono,color:'var(--mut)'}}>{i+1}</td>
                            <td style={{...S.td,fontWeight:700}}>{r.name}</td>
                            <td style={{...S.td,...S.mono}}>{r.roll}</td>
                            <td style={{...S.td,fontSize:'12px',color:'var(--m2)'}}>{r.email||'—'}</td>
                            <td style={{...S.td,fontSize:'12px'}}>{r.department}</td>
                            <td style={S.td}><span style={S.bb2}>{r.year} Yr</span></td>
                            <td style={{...S.td,fontSize:'12px',maxWidth:'120px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.subject}>{r.subject}</td>
                            <td style={S.td}><span style={r.status==='present'?S.bdgG:S.bdgR}>● {r.status}</span></td>
                            <td style={S.td}><span style={S.rpill}>{r.distance}m</span></td>
                            <td style={{...S.td,...S.mono,whiteSpace:'nowrap',fontSize:'10px'}}>{new Date(r.marked_at).toLocaleString()}</td>
                            <td style={S.td}><a href={`https://maps.google.com/maps?q=${r.lat},${r.lng}`} target="_blank" rel="noreferrer" style={S.ml}>🗺</a></td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {toast && (
        <div style={{...S.toast,borderColor:toast.type==='er'?'rgba(239,68,68,.4)':'rgba(34,197,94,.4)'}}>
          {toast.type==='er'?'❌':'✅'} {toast.msg}
        </div>
      )}
    </>
  );
}

// ── QR Display ──────────────────────────────────────────
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
          <button style={S.smBtn} onClick={copy}>{copied?'✓ Copied!':'📋 Copy URL'}</button>
          <button style={S.smBtn} onClick={dl}>⬇ PNG</button>
          <button style={{...S.smBtn,color:'var(--red)',borderColor:'rgba(239,68,68,.3)'}} onClick={()=>onDelete(session.id)}>🗑 Delete</button>
        </div>
      </div>
    </div>
  );
}

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
          <span style={{color:'var(--grn)'}}>✅ {s.present_count||0} present</span> · <span style={{color:'var(--red)'}}>❌ {(s.response_count||0)-(s.present_count||0)} absent</span>
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

function FG({ label, children }) {
  return <div style={{marginBottom:'16px'}}><label style={{display:'block',fontSize:'11px',fontWeight:700,color:'var(--mut)',textTransform:'uppercase',letterSpacing:'.55px',marginBottom:'7px'}}>{label}</label>{children}</div>;
}
function Inp({ onChange, ...p }) { return <input style={S.inp} onChange={e=>onChange(e.target.value)} {...p}/>; }
function Empty({ icon, text }) { return <div style={{textAlign:'center',padding:'36px',color:'var(--mut)'}}><div style={{fontSize:'32px',marginBottom:'9px'}}>{icon}</div><p style={{fontSize:'13px'}}>{text}</p></div>; }
function Centered({ children }) { return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',position:'relative',zIndex:1}}>{children}</div>; }
function Spin() { return <div style={{width:'32px',height:'32px',border:'3px solid var(--bor)',borderTopColor:'var(--acc)',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>; }

const S = {
  nav:{position:'fixed',top:0,left:0,right:0,zIndex:200,height:'60px',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 20px',background:'rgba(4,7,15,.92)',backdropFilter:'blur(16px)',borderBottom:'1px solid var(--bor)'},
  brand:{fontWeight:800,fontSize:'17px',display:'flex',alignItems:'center',gap:'8px'},
  dot:{width:'8px',height:'8px',borderRadius:'50%',background:'var(--acc)',boxShadow:'0 0 10px var(--acc)',animation:'blink 2s infinite'},
  np:{padding:'6px 13px',borderRadius:'8px',fontSize:'13px',fontWeight:600,border:'none',background:'transparent',color:'var(--mut)',cursor:'pointer'},
  npOn:{background:'var(--s2)',color:'var(--acc)'},
  logoutBtn:{padding:'6px 14px',borderRadius:'8px',fontSize:'13px',fontWeight:600,border:'1px solid var(--bor)',background:'transparent',color:'var(--mut)',cursor:'pointer'},
  wrap:{maxWidth:'1100px',margin:'0 auto',padding:'32px 20px 60px'},
  sh:{marginBottom:'24px'},h2:{fontSize:'23px',fontWeight:800,letterSpacing:'-.5px'},shp:{color:'var(--m2)',fontSize:'13px',marginTop:'5px'},
  card:{background:'var(--sur)',border:'1px solid var(--bor)',borderRadius:'14px',padding:'24px'},
  ch:{fontSize:'16px',fontWeight:700,marginBottom:'4px'},cs:{fontSize:'12px',color:'var(--mut)',marginBottom:'18px'},
  dv:{height:'1px',background:'var(--bor)',margin:'18px 0'},
  hint:{fontSize:'11px',color:'var(--mut)',marginTop:'6px',lineHeight:'1.55'},
  errBox:{background:'rgba(239,68,68,.1)',border:'1px solid rgba(239,68,68,.3)',borderRadius:'8px',padding:'10px 14px',color:'var(--red)',fontSize:'13px',marginBottom:'16px'},
  btnP:{width:'100%',padding:'13px',borderRadius:'10px',background:'var(--acc)',color:'#fff',fontSize:'15px',fontWeight:700,border:'none',cursor:'pointer'},
  smBtn:{padding:'7px 12px',borderRadius:'7px',fontSize:'12px',fontWeight:600,background:'var(--s2)',border:'1px solid var(--bor)',color:'var(--m2)',cursor:'pointer'},
  inp:{width:'100%',padding:'11px 14px',background:'var(--s2)',border:'1px solid var(--bor)',borderRadius:'10px',color:'var(--txt)',fontFamily:'var(--fnt)',fontSize:'14px',outline:'none'},
  r2:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'13px'},
  r3:{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'13px'},
  grid2:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'20px'},
  // 3 stat cards (no Rate)
  statsGrid:{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'13px',marginBottom:'22px'},
  sc:{background:'var(--sur)',border:'1px solid',borderRadius:'12px',padding:'17px'},
  fbar:{display:'flex',gap:'9px',marginBottom:'16px',flexWrap:'wrap',alignItems:'center'},
  finp:{flex:1,padding:'9px 12px',background:'var(--s2)',border:'1px solid var(--bor)',borderRadius:'8px',color:'var(--txt)',fontSize:'13px',outline:'none'},
  fsel:{padding:'9px 12px',background:'var(--s2)',border:'1px solid var(--bor)',borderRadius:'8px',color:'var(--txt)',fontSize:'13px',outline:'none'},
  twrap:{overflowX:'auto',borderRadius:'12px',border:'1px solid var(--bor)'},
  th:{padding:'11px 13px',textAlign:'left',fontWeight:700,color:'var(--mut)',fontSize:'10px',textTransform:'uppercase',letterSpacing:'.5px',whiteSpace:'nowrap',background:'var(--s2)',borderBottom:'1px solid var(--bor)'},
  td:{padding:'11px 13px',borderTop:'1px solid var(--bor)'},
  mono:{fontFamily:'var(--mono)',fontSize:'11px'},
  rpill:{fontFamily:'var(--mono)',fontSize:'11px',padding:'2px 7px',borderRadius:'4px',background:'var(--s3)'},
  bdgG:{display:'inline-flex',alignItems:'center',gap:'4px',padding:'3px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:700,background:'rgba(34,197,94,.12)',color:'var(--grn)',border:'1px solid rgba(34,197,94,.25)'},
  bdgR:{display:'inline-flex',alignItems:'center',gap:'4px',padding:'3px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:700,background:'rgba(239,68,68,.12)',color:'var(--red)',border:'1px solid rgba(239,68,68,.25)'},
  bb2:{display:'inline-flex',alignItems:'center',gap:'4px',padding:'3px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:700,background:'rgba(59,130,246,.12)',color:'var(--acc)',border:'1px solid rgba(59,130,246,.25)'},
  ml:{display:'inline-flex',alignItems:'center',color:'var(--acc)',fontSize:'12px',padding:'3px 9px',borderRadius:'6px',background:'rgba(59,130,246,.1)',border:'1px solid rgba(59,130,246,.2)'},
  toast:{position:'fixed',bottom:'18px',right:'18px',zIndex:9999,padding:'11px 16px',borderRadius:'10px',background:'var(--s2)',border:'1px solid',fontSize:'13px',fontWeight:600,animation:'slideIn .3s ease',boxShadow:'0 8px 30px rgba(0,0,0,.45)'},
};
