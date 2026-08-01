// ============================================================
//  Aura TIKTOK DM — Playwright Browser Automation
//  Entra no TikTok web via Playwright e envia DMs
//  NOTA: Requer sessao TikTok activa (login manual primeiro)
// ============================================================

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';

var execFileAsync = promisify(execFile);

var SCRIPT_PATH = path.join(process.cwd(), 'scripts', 'tiktok_dm.py');

export var maxDuration = 120;

async function runTikTokDmScript(args: string[]): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    var result = await execFileAsync('python3', [SCRIPT_PATH, ...args], {
      timeout: 110000, // 110s timeout
      maxBuffer: 2 * 1024 * 1024,
      env: {
        ...process.env,
        HOME: process.env.HOME || '/root',
        PLAYWRIGHT_BROWSERS_PATH: '/root/.cache/ms-playwright',
      },
    });
    var stdout = result.stdout.trim();
    var stderr = result.stderr.trim();

    // Parse JSON output
    try {
      // Find JSON in output (might have print statements before)
      var jsonMatch = stdout.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return { success: true, data: JSON.parse(jsonMatch[0]) };
      }
      // Try array
      var arrMatch = stdout.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        return { success: true, data: JSON.parse(arrMatch[0]) };
      }
    } catch (e) {
      // JSON parse failed, return raw output
    }

    if (stderr && !stdout) {
      return { success: false, error: stderr.slice(0, 500) };
    }

    return { success: true, data: { raw_output: stdout.slice(0, 500) } };
  } catch (e: any) {
    return { success: false, error: e.message.slice(0, 500) };
  }
}

export async function POST(request: Request) {
  var authError = requireAuth(request);
  if (authError) return authError;
  var body = await request.json().catch(function() { return {}; });
  var action = body.action || '';

  // ===== STATUS =====
  if (action === 'status') {
    return NextResponse.json({
      success: true,
      type: 'tiktok_dm_status',
      engine: 'playwright',
      capabilities: [
        'login - Login manual no TikTok (guarda sessao)',
        'send - Enviar DM para um utilizador',
        'send_bulk - Enviar DMs para multiplos utilizadores',
        'check_inbox - Verificar mensagens recebidas',
        'check_login - Verificar se sessao esta activa',
        'get_log - Ver historico de DMs enviados',
      ],
      note: 'Requer sessao TikTok logada. Primeiro uso: action=login (abre browser para login manual)',
      limitations: [
        'Funciona em Vercel? NAO - Playwright so roda em servidor com browser.',
        'Para Vercel: usar Browserless.io ou rodar localmente.',
        'TikTok pode detectar automacao e bloquear conta.',
        'Rate limit: esperar 5-11s entre DMs.',
      ],
      available_actions: ['login', 'send', 'send_bulk', 'check_inbox', 'check_login', 'get_log', 'status'],
    });
  }

  // ===== CHECK LOGIN =====
  if (action === 'check_login') {
    var loginResult = await runTikTokDmScript(['--action', 'check_login', '--no-headless']);
    return NextResponse.json(loginResult);
  }

  // ===== SEND DM =====
  if (action === 'send') {
    var username = body.username || '';
    var message = body.message || '';
    if (!username) return NextResponse.json({ success: false, error: 'username necessario' });
    if (!message) return NextResponse.json({ success: false, error: 'message necessario' });

    var sendResult = await runTikTokDmScript([
      '--action', 'send',
      '--username', username,
      '--message', message,
    ]);
    return NextResponse.json(sendResult);
  }

  // ===== SEND BULK =====
  if (action === 'send_bulk') {
    var users = body.users || body.usernames || '';
    var bulkMsg = body.message || '';
    if (!users) return NextResponse.json({ success: false, error: 'users (lista separada por virgula) necessario' });
    if (!bulkMsg) return NextResponse.json({ success: false, error: 'message necessario' });

    var bulkResult = await runTikTokDmScript([
      '--action', 'send_bulk',
      '--users', users,
      '--message', bulkMsg,
    ]);
    return NextResponse.json(bulkResult);
  }

  // ===== CHECK INBOX =====
  if (action === 'check_inbox') {
    var inboxResult = await runTikTokDmScript(['--action', 'check_inbox']);
    return NextResponse.json(inboxResult);
  }

  // ===== GET LOG =====
  if (action === 'get_log') {
    var logResult = await runTikTokDmScript(['--action', 'get_log']);
    return NextResponse.json(logResult);
  }

  return NextResponse.json({ error: 'Accao desconhecida: ' + action });
}
