// ============================================================
//  Aura AUTH API — Login e validacao de sessao
// ============================================================

import { NextResponse } from 'next/server';
import { login, validateSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const password = body.password || '';

    if (!password) {
      return NextResponse.json({ error: 'Envia a password' }, { status: 400 });
    }

    const result = login(password);
    if (!result.success) {
      return NextResponse.json({ error: 'Password incorrecta' }, { status: 401 });
    }

    return NextResponse.json({ success: true, token: result.token });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') || '';
  const valid = validateSession(token);
  return NextResponse.json({ valid });
}
