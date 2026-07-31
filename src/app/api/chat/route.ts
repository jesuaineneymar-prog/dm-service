// ============================================================
//  JARVIS CHAT API — Server-side AI chat
//  O client NUNCA chama OpenRouter directamente
//  Protegido por sessao (auth middleware)
// ============================================================

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { chatCompletion } from '@/lib/ai';

export var maxDuration = 30;

export async function POST(request: Request) {
  // Auth check
  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const messages = body.messages || [];

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Envia mensagens no formato { messages: [...] }' }, { status: 400 });
    }

    const reply = await chatCompletion(messages);
    return NextResponse.json({ success: true, reply });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
