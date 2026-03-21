// pages/api/auth/logout.js
import { clearAuthCookie } from '../../../lib/auth';
export default function handler(req, res) {
  clearAuthCookie(res);
  res.json({ ok: true });
}
