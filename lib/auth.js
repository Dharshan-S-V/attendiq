// lib/auth.js
import jwt from 'jsonwebtoken';
import { parse, serialize } from 'cookie';

const SECRET = process.env.JWT_SECRET || 'attendiq-secret-change-in-production';
const COOKIE  = 'iq_token';

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  try { return jwt.verify(token, SECRET); }
  catch { return null; }
}

export function getAdminFromReq(req) {
  const cookies = parse(req.headers.cookie || '');
  const token   = cookies[COOKIE];
  if (!token) return null;
  return verifyToken(token);
}

export function setAuthCookie(res, token) {
  res.setHeader('Set-Cookie', serialize(COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 24 * 7,
    path:     '/'
  }));
}

export function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', serialize(COOKIE, '', {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', maxAge: 0, path: '/'
  }));
}
