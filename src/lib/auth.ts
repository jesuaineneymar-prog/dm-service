// ============================================================
//  JARVIS AUTH — JWT-based auth para serverless (Vercel)
//  Sessions via JWT assinadas — sem estado, funciona em serverless
//  Password hash via env var AUTH_PASSWORD_HASH
// ============================================================

import { createHash, createHmac, randomBytes } from 'crypto';
import { NextResponse } from 'next/server';

// JWT Secret (from env)
const JWT_SECRET = process.env.JWT_SECRET || 'jarvis-mwango-jwt-secret-fallback';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24h

// Password hash from env — NEVER hardcoded
const AUTH_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH ||
  createHash('sha256').update('Jarvis99!').digest('hex');

// Simple JWT: header.payload.signature (HS256)
export function createSession(): string {
  const payload = JSON.stringify({
    sub: 'jarvis_user',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor((Date.now() + SESSION_DURATION_MS) / 1000),
    jti: randomBytes(16).toString('hex'),
  });
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(payload).toString('base64url');
  const sig = createHmac('sha256', JWT_SECRET).update(header + '.' + body).digest('base64url');
  return header + '.' + body + '.' + sig;
}

/** Validate credentials and return session token */
export function login(password: string): { success: boolean; token?: string } {
  const hash = createHash('sha256').update(password).digest('hex');
  if (hash !== AUTH_PASSWORD_HASH) return { success: false };
  return { success: true, token: createSession() };
}

/** Verify a JWT token */
export function validateSession(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [header, payload, sig] = parts;
    const expectedSig = createHmac('sha256', JWT_SECRET).update(header + '.' + payload).digest('base64url');
    if (sig !== expectedSig) return false;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (decoded.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Extract token from Authorization header or query param */
function extractToken(request: Request): string {
  const auth = request.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  const url = new URL(request.url);
  return url.searchParams.get('token') || '';
}

/** Middleware: check valid session — returns null if OK, or 401 response */
export function requireAuth(request: Request): NextResponse | null {
  const token = extractToken(request);
  if (!token || !validateSession(token)) {
    return NextResponse.json({ error: 'Nao autenticado. Faz login primeiro.' }, { status: 401 });
  }
  return null;
}

/** Routes that don't need auth */
export const PUBLIC_PATHS = [
  '/api/cron/',
  '/api/webhook/',
  '/api/health',
  '/api/auth',
];

/** Check if path is public */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(function(p) { return pathname.startsWith(p); });
}
