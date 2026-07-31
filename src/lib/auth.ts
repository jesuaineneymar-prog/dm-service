// ============================================================
//  JARVIS AUTH — Middleware de autenticacao simples
//  Protege todas as /cmd/* e /api/* (excepto cron e webhook)
//  Usa password hasheada com SHA-256 + token de sessao
// ============================================================

import { createHash } from 'crypto';

const AUTH_PASSWORD_HASH = createHash('sha256').update('Jarvis99!').digest('hex');
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24h

interface Session {
  token: string;
  createdAt: number;
}

// In-memory session store (serverless — short-lived)
const sessions = new Map<string, Session>();

/**
 * Gera token de sessao
 */
export function createSession(): string {
  const token = createHash('sha256').update(Date.now().toString(36) + Math.random().toString(36)).digest('hex').slice(0, 32);
  sessions.set(token, { token, createdAt: Date.now() });
  return token;
}

/**
 * Valida credenciais e devolve token de sessao
 */
export function login(password: string): { success: boolean; token?: string } {
  const hash = createHash('sha256').update(password).digest('hex');
  if (hash !== AUTH_PASSWORD_HASH) return { success: false };
  const token = createSession();
  return { success: true, token };
}

/**
 * Verifica se um token de sessao e valido
 */
export function validateSession(token: string): boolean {
  const session = sessions.get(token);
  if (!session) return false;
  if (Date.now() - session.createdAt > SESSION_DURATION_MS) {
    sessions.delete(token);
    return false;
  }
  return true;
}

/**
 * Extrai token do Authorization header ou query param
 */
function extractToken(request: Request): string {
  const auth = request.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  const url = new URL(request.url);
  return url.searchParams.get('token') || '';
}

/**
 * Middleware: verifica se o request tem sessao valida
 * Return null se OK, ou NextResponse de erro
 */
import { NextResponse } from 'next/server';

export function requireAuth(request: Request): NextResponse | null {
  const token = extractToken(request);
  if (!token || !validateSession(token)) {
    return NextResponse.json({ error: 'Nao autenticado. Faz login primeiro.' }, { status: 401 });
  }
  return null; // Auth OK
}

/**
 * Rotas que nao precisam de auth (crons, webhooks)
 */
export const PUBLIC_PATHS = [
  '/api/cron/',
  '/api/webhook/',
];

/**
 * Verifica se o path e publico
 */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(function(p) { return pathname.startsWith(p); });
}
