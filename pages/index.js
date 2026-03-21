// pages/index.js
import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    fetch('/api/auth/me').then(r => {
      if (r.ok) router.push('/admin');
      else router.push('/login');
    }).catch(() => router.push('/login'));
  }, []);

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', position:'relative', zIndex:1 }}>
      <div style={{ color:'var(--m2)', fontSize:'14px' }}>Redirecting…</div>
    </div>
  );
}
