// pages/index.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';
export default function Index() {
  const router = useRouter();
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? router.push('/admin') : router.push('/login')).catch(() => router.push('/login'));
  }, []);
  return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--bg)'}}><div style={{width:'28px',height:'28px',border:'2.5px solid rgba(0,0,0,0.1)',borderTopColor:'#0071e3',borderRadius:'50%',animation:'spin .7s linear infinite'}}/></div>;
}
