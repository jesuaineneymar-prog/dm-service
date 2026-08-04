// ============================================================
//  Aura v4 — NSTBrowser Engine
//  Anti-detect browser para FB DMs (e IG fallback)
//  Conecta via API local (porta 8899) + puppeteer-core
// ============================================================

import { NST_BROWSER_URL } from './config';
import { runScript } from './script-runner';

// === TYPES ===

export interface NSTDMResult {
  success: boolean;
  error?: string;
  recipient?: string;
  provider?: string;
}

export interface NSTProfileInfo {
  id: string;
  name: string;
  platform?: string;
}

export interface NSTStatus {
  nstRunning: boolean;
  profiles: NSTProfileInfo[];
  nstUrl: string;
}

// === NSTBrowser API ===

/**
 * Check if NSTBrowser local API is reachable
 */
export async function nstCheckRunning(): Promise<boolean> {
  try {
    var res = await fetch(NST_BROWSER_URL + '/', { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch (e) {
    return false;
  }
}

/**
 * List all NSTBrowser profiles
 */
export async function nstListProfiles(): Promise<NSTProfileInfo[]> {
  try {
    var res = await fetch(NST_BROWSER_URL + '/profile/list', { signal: AbortSignal.timeout(10000) });
    var data = await res.json();
    var list: any[] = data.data?.list || data.data || data.list || [];
    return list.map(function(p: any) {
      return { id: String(p.id), name: p.name || 'unnamed', platform: p.browserSetting?.platform || undefined };
    });
  } catch (e: any) {
    return [];
  }
}

/**
 * Get NSTBrowser status (running, profiles, etc)
 */
export async function nstStatus(): Promise<NSTStatus> {
  var nstRunning = await nstCheckRunning();
  var profiles = nstRunning ? await nstListProfiles() : [];
  return { nstRunning: nstRunning, profiles: profiles, nstUrl: NST_BROWSER_URL };
}

/**
 * Find an NSTBrowser profile by name pattern
 */
export async function nstFindProfile(namePattern: string): Promise<NSTProfileInfo | null> {
  var profiles = await nstListProfiles();
  var lower = namePattern.toLowerCase();
  return profiles.find(function(p) { return p.name.toLowerCase().includes(lower); }) || null;
}

// === FB DM via NSTBrowser ===

/**
 * Send Facebook DM via NSTBrowser
 */
export async function nstFBSendDM(recipientName: string, message: string): Promise<NSTDMResult> {
  try {
    var fbProfile = await nstFindProfile('fb');
    if (!fbProfile) fbProfile = await nstFindProfile('facebook');
    if (!fbProfile) {
      var profiles = await nstListProfiles();
      if (profiles.length === 0) {
        return { success: false, error: 'Nenhum perfil NST encontrado. Cria um perfil FB no NSTBrowser.' };
      }
      fbProfile = profiles[0];
    }

    var profileId = fbProfile!.id;
    var result = await runScript('send-fb-dm.js', [profileId, recipientName, message], { timeout: 90000 });
    if (result.success) return { ...result.data, provider: 'nstbrowser' };
    return { success: false, error: result.error };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Send IG DM via NSTBrowser (fallback)
 */
export async function nstIGSendDM(recipientUsername: string, message: string): Promise<NSTDMResult> {
  try {
    var igProfile = await nstFindProfile('ig');
    if (!igProfile) igProfile = await nstFindProfile('instagram');
    if (!igProfile) {
      var profiles2 = await nstListProfiles();
      if (profiles2.length === 0) {
        return { success: false, error: 'Nenhum perfil NST encontrado' };
      }
      igProfile = profiles2[0];
    }

    var igProfileId = igProfile!.id;
    var result = await runScript('send-ig-dm-nst.js', [igProfileId, recipientUsername, message], { timeout: 90000 });
    if (result.success) return result.data;
    // Script pode nao existir — usar private API
    return { success: false, error: result.error || 'NST IG DM script not available. Use private API instead.' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}
