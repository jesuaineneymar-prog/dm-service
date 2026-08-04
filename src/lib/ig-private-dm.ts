// ============================================================
//  AURA v4 — Instagram Private API DM Engine
//  Login server-side via /cmd/ig-login (sem PC)
//  Sessao persistida no DB (SystemSetting) + ficheiro local
// ============================================================

import { runScript, getScriptsFilePath } from './script-runner';

var SESSION_RESTORED = false;

interface IGDMSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface IGSessionInfo {
  valid: boolean;
  username?: string;
  userId?: number;
  source: string;
}

/**
 * Restaurar sessao do DB para ficheiro local
 */
async function ensureSessionFile(): Promise<void> {
  if (SESSION_RESTORED) return;
  SESSION_RESTORED = true;
  try {
    var { db, ensureDatabase } = await import('./db');
    await ensureDatabase();
    var setting = await db.systemSetting.findUnique({ where: { key: 'ig_private_session' } });
    if (!setting) return;
    var fs = require('fs');
    var sessionPath = getScriptsFilePath('ig-session.json');
    try {
      var existing = fs.readFileSync(sessionPath, 'utf-8');
      if (existing && existing.length > 10) return;
    } catch (e) { /* ficheiro nao existe */ }
    fs.writeFileSync(sessionPath, setting.value);
  } catch (e) { /* ignore */ }
}

/**
 * Enviar DM via Instagram Private API
 */
export async function sendIGPrivateDM(recipientUsername: string, message: string): Promise<IGDMSendResult> {
  await ensureSessionFile();
  try {
    var result = await runScript('send-ig-dm.js', [recipientUsername, message], { timeout: 60000 });
    if (result.success) return result.data as IGDMSendResult;
    return { success: false, error: result.error };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Verificar se a sessao IG private API e valida
 */
export async function checkIGPrivateSession(): Promise<IGSessionInfo> {
  try {
    var result = await runScript('check-ig-session.js', [], { timeout: 30000 });
    if (result.success) return result.data as IGSessionInfo;
    return { valid: false, source: 'private_api' };
  } catch (e: any) {
    return { valid: false, source: 'private_api' };
  }
}

/**
 * Extrair cookies de uma pagina Puppeteer
 */
export async function extractCookiesFromPage(page: any): Promise<string> {
  var cookies = await page.cookies('https://www.instagram.com');
  var cookieDict: Record<string, string> = {};
  for (var c of cookies) {
    cookieDict[c.name] = c.value;
  }
  return JSON.stringify(cookieDict);
}

/**
 * Listar conversas DM do inbox
 */
export async function listIGInbox(limit?: number): Promise<any> {
  try {
    var args = limit ? [limit.toString()] : [];
    var result = await runScript('list-ig-inbox.js', args, { timeout: 30000 });
    if (result.success) return result.data;
    return { success: false, error: result.error, threads: [] };
  } catch (e: any) {
    return { success: false, error: e.message, threads: [] };
  }
}
