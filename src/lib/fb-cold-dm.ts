// ============================================================
//  FACEBOOK COLD DM via Meta Graph API
//  Sem browser — directo via Graph API (page token)
//  Bypass: browser DMs davam 403, Graph API funciona
// ============================================================

import { metaSendDM } from './meta-graph';
import { db } from './db';

// --- Send a cold DM to a Facebook user via Graph API ---
export async function fbColdDM(target: string, message: string, opts?: {
  userId?: string;
  log?: boolean;
}): Promise<{
  success: boolean;
  error?: string;
  debug?: string;
}> {
  var cleanTarget = target.trim().replace(/^@/, '');
  if (!cleanTarget) return { success: false, error: 'Target vazio' };
  if (!message.trim()) return { success: false, error: 'Mensagem vazia' };

  // Need a numeric user ID for Graph API
  var userId = opts?.userId || '';
  if (!userId) {
    // If target looks numeric, use it directly
    if (/^\d+$/.test(cleanTarget)) {
      userId = cleanTarget;
    } else {
      return { success: false, error: 'userId numerico necessario para Facebook cold DM via Graph API. Usa o campo userId.' };
    }
  }

  try {
    // Delegate to meta-graph (Graph API)
    var result = await metaSendDM({
      platform: 'facebook',
      recipientId: userId,
      message: message,
    });

    // Log to DB
    try {
      await db.automationLog.create({
        data: {
          type: 'cold_dm',
          action: result.success ? 'sent' : 'failed',
          platform: 'facebook',
          targetName: cleanTarget,
          status: result.success ? 'completed' : 'failed',
          result: JSON.stringify({ message: message.slice(0, 200), provider: 'graph_api' }),
        },
      });
    } catch (e) { /* ignore */ }

    if (result.success) {
      return { success: true, debug: 'target=' + cleanTarget + ', chars=' + message.length + ', provider=graph_api' };
    } else {
      return { success: false, error: result.error || 'Falha ao enviar DM via Graph API' };
    }
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
