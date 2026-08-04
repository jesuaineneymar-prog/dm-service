import { SCRAPING_BEE_KEY, UPLOADPOST_KEY, N8N_WEBHOOK_URL, SERPAPI_KEY } from './config';

// ============================================================
//  Aura EXTERNAL API INTEGRATIONS
//  ScrapingBee (Web Scraping), Upload-Post (Publishing),
//  ManyChat (Auto-Reply DMs), N8N (Webhooks), SerpAPI (Search)
//  DMs: Zernio (IG + FB), Meta Graph API (Proactive)
// ============================================================

// --- ScrapingBee (Web Scraping API — replaces HikerAPI) ---
// Docs: https://www.scrapingbee.com/documentation/
// Pricing: Free 1000 credits/mo, then $49/mo

var SB_BASE = 'https://app.scrapingbee.com/api/v1';

// ScrapingBee: Scrape any URL (general purpose)
export async function sbScrape(url: string, options?: {
  render_js?: boolean;
  premium_proxy?: boolean;
  country_code?: string;
  wait?: number;
  extract_rules?: any;
  timeout?: number;
}) {
  try {
    if (!SCRAPING_BEE_KEY) return { success: false, error: 'SEM_SCRAPINGBEE_KEY: Configura SCRAPING_BEE_API_KEY' };
    var params = new URLSearchParams({
      api_key: SCRAPING_BEE_KEY,
      url: url,
      render_js: String(options?.render_js || false),
    });
    if (options?.premium_proxy) params.set('premium_proxy', 'true');
    if (options?.country_code) params.set('country_code', options.country_code);
    if (options?.wait) params.set('wait', String(options.wait));
    if (options?.extract_rules) params.set('extract_rules', JSON.stringify(options.extract_rules));
    var res = await fetch(SB_BASE + '?' + params.toString());
    if (!res.ok) { var errText = await res.text().catch(function() { return ''; }); return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 300) }; }
    var contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      var data = await res.json();
      return { success: true, data: data, contentType: 'json' };
    }
    var html = await res.text();
    return { success: true, data: html, contentType: 'html' };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// ScrapingBee: Scrape Instagram public profile
export async function sbGetIGProfile(username: string) {
  return sbScrape('https://www.instagram.com/' + username + '/', {
    render_js: true,
    wait: 3000,
    premium_proxy: true,
  });
}

// ScrapingBee: Scrape Instagram post comments
export async function sbGetIGComments(postUrl: string) {
  return sbScrape(postUrl, { render_js: true, wait: 2000, premium_proxy: true });
}

// ScrapingBee: Scrape Facebook public page
export async function sbGetFBPage(pageName: string) {
  return sbScrape('https://www.facebook.com/' + pageName + '/', {
    render_js: true,
    wait: 3000,
    premium_proxy: true,
  });
}

// ScrapingBee: Google search scraping (no SerpAPI needed)
export async function sbGoogleSearch(query: string, numResults?: number) {
  return sbScrape('https://www.google.com/search?q=' + encodeURIComponent(query) + '&num=' + (numResults || 10), {
    render_js: false,
    premium_proxy: true,
  });
}

// ScrapingBee: Scrape any social media profile
export async function sbScrapeSocial(platform: string, username: string) {
  var urls: Record<string, string> = {
    instagram: 'https://www.instagram.com/' + username + '/',
    facebook: 'https://www.facebook.com/' + username + '/',
    twitter: 'https://twitter.com/' + username,
    tiktok: 'https://www.tiktok.com/@' + username,
    linkedin: 'https://www.linkedin.com/in/' + username + '/',
  };
  var url = urls[platform] || 'https://www.instagram.com/' + username + '/';
  return sbScrape(url, { render_js: true, wait: 3000, premium_proxy: true });
}

// --- Upload-Post: Send DM (outbound — Instagram) ---
var UP_DM_BASE = 'https://api.upload-post.com';

export async function upSendDMOutbound(apiKey: string, options: {
  recipientId: string;
  message: string;
  platform?: string;
  user?: string;
}) {
  try {
    var res = await fetch(UP_DM_BASE + '/api/uploadposts/dms/send', {
      method: 'POST',
      headers: { 'Authorization': 'Apikey ' + apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ platform: options.platform || 'instagram', user: options.user || 'jarvis', recipient_id: options.recipientId, message: options.message }),
    });
    if (!res.ok) { var errText = await res.text().catch(function() { return ''; }); return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 300) }; }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- Upload-Post.com API (Content Publishing) ---
var UP_BASE = 'https://api.upload-post.com/api';

export async function upPost(apiKey: string, options: {
  platform: string;
  mediaUrl?: string;
  mediaData?: string;
  caption?: string;
  profileId?: string;
  publishAt?: string;
}) {
  try {
    var body: any = { platform: options.platform, caption: options.caption || '' };
    if (options.mediaUrl) body.mediaUrl = options.mediaUrl;
    if (options.mediaData) body.mediaData = options.mediaData;
    if (options.profileId) body.profileId = options.profileId;
    if (options.publishAt) body.publishAt = options.publishAt;
    var form = new FormData();
    form.append('user', 'jarvis');
    form.append('title', options.caption || '');
    if (options.mediaUrl) {
      var isVideo = /video|mp4|mov|avi/.test(options.mediaUrl);
      form.append(isVideo ? 'video' : 'photos[]', options.mediaUrl);
    }
    if (options.platform) form.append('platform[]', options.platform);
    if (options.publishAt) form.append('scheduled_date', options.publishAt);
    var upUrl = options.mediaUrl
      ? (options.mediaUrl.match(/video|mp4|mov|avi/) ? UP_BASE + '/upload' : UP_BASE + '/upload_photos')
      : UP_BASE + '/upload_text';
    var res = await fetch(upUrl, {
      method: 'POST',
      headers: { 'Authorization': 'Apikey ' + apiKey },
      body: options.mediaUrl ? form : ('user=jarvis&title=' + encodeURIComponent(options.caption || '') + '&platform[]=' + (options.platform || 'facebook')),
    });
    if (!res.ok) { var errText = await res.text().catch(function() { return ''; }); return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 200) }; }
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function upGetPostStatus(apiKey: string, postId: string) {
  try {
    var res = await fetch('https://api.upload-post.com/api/uploadposts/status?request_id=' + postId, {
      headers: { 'Authorization': 'Apikey ' + apiKey, 'Accept': 'application/json' },
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function upListProfiles(apiKey: string) {
  try {
    var res = await fetch('https://api.upload-post.com/api/uploadposts/users', {
      headers: { 'Authorization': 'Apikey ' + apiKey, 'Accept': 'application/json' },
    });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    var data = await res.json();
    return { success: true, data: data };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function upListPlatforms(apiKey: string) {
  try {
    var profileRes = await fetch('https://api.upload-post.com/api/uploadposts/users', {
      headers: { 'Authorization': 'Apikey ' + apiKey, 'Accept': 'application/json' },
    });
    if (!profileRes.ok) return { success: false, error: 'HTTP ' + profileRes.status };
    var profileData = await profileRes.json();
    var platforms = profileData.profiles?.[0]?.platforms || [];
    return { success: true, data: platforms };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- ManyChat API (Auto-Reply DMs) ---
var MC_BASE = 'https://api.manychat.com';

export async function mcSendDM(apiKey: string, options: { platform: string; userId: string; message: string; }) {
  try {
    var res = await fetch(MC_BASE + '/fb/v2/messages', {
      method: 'POST',
      headers: { 'Authorization': 'Apikey ' + apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ platform: options.platform, recipient_id: options.userId, message: { text: options.message } }),
    });
    if (!res.ok) { var t = await res.text().catch(function() { return ''; }); return { success: false, error: 'HTTP ' + res.status + ': ' + t.slice(0, 200) }; }
    return { success: true, data: await res.json() };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function mcGetConversations(apiKey: string, platform?: string) {
  try {
    var url = MC_BASE + '/fb/v2/conversations';
    if (platform) url += '?platform=' + platform;
    var res = await fetch(url, { headers: { 'Authorization': 'Apikey ' + apiKey, 'Accept': 'application/json' } });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    return { success: true, data: await res.json() };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function mcTriggerFlow(apiKey: string, options: { platform: string; userId: string; flowId: string; }) {
  try {
    var res = await fetch(MC_BASE + '/fb/v2/flows/trigger', {
      method: 'POST',
      headers: { 'Authorization': 'Apikey ' + apiKey, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ platform: options.platform, recipient_id: options.userId, flow_id: options.flowId }),
    });
    if (!res.ok) { var t = await res.text().catch(function() { return ''; }); return { success: false, error: 'HTTP ' + res.status + ': ' + t.slice(0, 200) }; }
    return { success: true, data: await res.json() };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- N8N Webhook Integration ---
export async function n8nTrigger(webhookUrl: string, payload: any) {
  try {
    var res = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) return { success: false, error: 'HTTP ' + res.status };
    return { success: true, data: await res.json() };
  } catch (e: any) { return { success: false, error: e.message }; }
}

// --- SerpAPI ---
var SERP_BASE = 'https://serpapi.com/search';

export async function serpSearch(query: string, options?: { engine?: string; num?: number; location?: string; hl?: string; tbm?: string; }) {
  try {
    var key = SERPAPI_KEY;
    if (!key) return { success: false, error: 'SEM_SERPAPI_KEY: Regista-te em serpapi.com' };
    var params = new URLSearchParams({ api_key: key, q: query, engine: options?.engine || 'google', num: String(options?.num || 10) });
    if (options?.location) params.set('location', options.location);
    if (options?.hl) params.set('hl', options.hl);
    if (options?.tbm) params.set('tbm', options.tbm);
    var res = await fetch(SERP_BASE + '?' + params.toString());
    if (!res.ok) { var errText = await res.text().catch(function() { return ''; }); return { success: false, error: 'HTTP ' + res.status + ': ' + errText.slice(0, 200) }; }
    var data = await res.json();
    var results = (data.organic_results || []).slice(0, options?.num || 10).map(function(r: any) { return { title: r.title || '', link: r.link || '', snippet: r.snippet || '', position: r.position || 0 }; });
    return { success: true, data: { query, results, totalResults: data.search_information?.total_results || 0, location: data.search_information?.location || '' } };
  } catch (e: any) { return { success: false, error: e.message }; }
}

export async function serpTrends(query: string, options?: { geo?: string; date?: string; hl?: string; }) {
  return serpSearch(query, { engine: 'google_trends', num: 10, hl: options?.hl || 'pt', ...options });
}

export async function serpNews(query: string, options?: { location?: string; hl?: string; }) {
  return serpSearch(query, { engine: 'google', tbm: 'nws', hl: options?.hl || 'pt', location: options?.location || 'Angola' });
}

export async function serpContentIdeas(topic: string, platform?: string) {
  var query = platform === 'instagram' ? topic + ' site:instagram.com trending' :
              platform === 'facebook' ? topic + ' trending angola facebook' :
              topic + ' trending social media angola';
  return serpSearch(query, { num: 10, hl: 'pt', location: 'Angola' });
}

// ============================================================
//  CONFIG MANAGEMENT
// ============================================================

export interface ExternalConfig {
  scrapingBeeKey: string;
  uploadPostApiKey: string;
  n8nWebhookUrl: string;
}

export function getExternalConfig(): ExternalConfig {
  return {
    scrapingBeeKey: SCRAPING_BEE_KEY,
    uploadPostApiKey: UPLOADPOST_KEY,
    n8nWebhookUrl: N8N_WEBHOOK_URL,
  };
}
