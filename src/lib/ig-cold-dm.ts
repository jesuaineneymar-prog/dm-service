// ============================================================
//  INSTAGRAM COLD DM via instagrapi (Python subprocess)
//  Sem browser, sem Bright Data — directo via API privada
//  Bypass: BD bloqueia IG por KYC, instagrapi funciona sem proxy
// ============================================================

import { igSendDMByUsername } from './ig-publish';
import { db } from './db';

// --- Send a cold DM to an Instagram user via instagrapi ---
export async function igColdDM(username: string, message: string, opts?: {
  log?: boolean;
}): Promise<{
  success: boolean;
  error?: string;
  debug?: string;
}> {
  var cleanUser = username.replace(/^@/, '').trim();
  if (!cleanUser) return { success: false, error: 'Username vazio' };
  if (!message.trim()) return { success: false, error: 'Mensagem vazia' };

  try {
    // Delegate to ig-publish (instagrapi subprocess)
    var result = await igSendDMByUsername(cleanUser, message);

    // Log to DB
    try {
      await db.automationLog.create({
        data: {
          type: 'cold_dm',
          action: result.success ? 'sent' : 'failed',
          platform: 'instagram',
          targetName: cleanUser,
          status: result.success ? 'completed' : 'failed',
          result: JSON.stringify({ message: message.slice(0, 200), provider: 'instagrapi' }),
        },
      });
    } catch (e) { /* ignore */ }

    if (result.success) {
      return { success: true, debug: 'target=@' + cleanUser + ', chars=' + message.length + ', provider=instagrapi' };
    } else {
      return { success: false, error: result.error || 'Falha ao enviar DM via instagrapi' };
    }
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
