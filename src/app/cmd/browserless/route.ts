// ============================================================
//  JARVIS BROWSERLESS API — screenshots, scraping, extraccao
// ============================================================

import { NextResponse } from 'next/server';
import { BROWSERLESS_KEY } from '@/lib/config';

export var maxDuration = 60;
var BASE = 'https://chrome.browserless.io';

// ── actions ────────────────────────────────────────────────

async function screenshot(url: string, options: any) {
  var res = await fetch(BASE + '/screenshot?token=' + BROWSERLESS_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      options: {
        type: 'jpeg',
        quality: 80,
        fullPage: options?.fullPage !== false,
        width: options?.width || 1280,
        height: options?.height || 800,
      },
    }),
  });

  if (!res.ok) {
    var errText = await res.text();
    throw new Error('Browserless screenshot erro ' + res.status + ': ' + errText.slice(0, 300));
  }

  var contentType = res.headers.get('content-type') || '';

  if (contentType.includes('image')) {
    var buffer = Buffer.from(await res.arrayBuffer());
    return { success: true, data: 'data:image/jpeg;base64,' + buffer.toString('base64') };
  }

  var json = await res.json().catch(function () { return null; });
  if (json && json.data) return { success: true, data: json.data };
  if (json) return { success: true, data: json };

  return { success: false, error: 'Resposta inesperada do Browserless' };
}

async function scrape(url: string, selector: string) {
  var body: any = { url };
  if (selector) body.selector = selector;

  var res = await fetch(BASE + '/scrape?token=' + BROWSERLESS_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    var errText = await res.text();
    throw new Error('Browserless scrape erro ' + res.status + ': ' + errText.slice(0, 300));
  }

  var json = await res.json();
  return { success: true, data: json };
}

async function extractProfile(platform: string, username: string) {
  var profileUrl = '';
  if (platform === 'instagram') profileUrl = 'https://www.instagram.com/' + username + '/';
  else if (platform === 'tiktok') profileUrl = 'https://www.tiktok.com/@' + username;
  else if (platform === 'facebook') profileUrl = 'https://www.facebook.com/' + username;
  else if (platform === 'twitter' || platform === 'x') profileUrl = 'https://x.com/' + username;
  else if (platform === 'linkedin') profileUrl = 'https://www.linkedin.com/in/' + username;
  else if (platform === 'youtube') profileUrl = 'https://www.youtube.com/@' + username;
  else return { success: false, error: 'Plataforma nao suportada: ' + platform };

  var res = await fetch(BASE + '/content?token=' + BROWSERLESS_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: profileUrl,
      elements: [
        { selector: 'meta[name="description"]', attribute: 'content' },
        { selector: 'meta[property="og:title"]', attribute: 'content' },
        { selector: 'meta[property="og:image"]', attribute: 'content' },
        { selector: 'meta[property="og:description"]', attribute: 'content' },
        { selector: 'h1', attribute: 'textContent' },
        { selector: 'h2', attribute: 'textContent' },
        { selector: 'title', attribute: 'textContent' },
      ],
    }),
  });

  if (!res.ok) {
    var errText = await res.text();
    throw new Error('Browserless content erro ' + res.status + ': ' + errText.slice(0, 300));
  }

  var json = await res.json();

  var profileData: any = {
    platform,
    username,
    profileUrl,
    bio: '',
    followers: null,
    following: null,
    posts: null,
    avatar: '',
    displayName: '',
  };

  var data = json.data || json;
  if (Array.isArray(data)) {
    for (var i = 0; i < data.length; i++) {
      var el = data[i];
      if (el.type === 'meta' && el.name === 'description' && el.value) profileData.bio = el.value;
      if (el.type === 'meta' && el.property === 'og:title' && el.value) profileData.displayName = el.value;
      if (el.type === 'meta' && el.property === 'og:image' && el.value) profileData.avatar = el.value;
      if (el.type === 'meta' && el.property === 'og:description' && el.value && !profileData.bio) profileData.bio = el.value;
      if (el.type === 'title' && el.value && !profileData.displayName) profileData.displayName = el.value;
    }
  }

  profileData._raw = json;
  return { success: true, data: profileData };
}

async function checkAccount(platform: string, username: string) {
  var profileUrl = '';
  if (platform === 'instagram') profileUrl = 'https://www.instagram.com/' + username + '/';
  else if (platform === 'tiktok') profileUrl = 'https://www.tiktok.com/@' + username;
  else if (platform === 'facebook') profileUrl = 'https://www.facebook.com/' + username;
  else if (platform === 'twitter' || platform === 'x') profileUrl = 'https://x.com/' + username;
  else if (platform === 'linkedin') profileUrl = 'https://www.linkedin.com/in/' + username;
  else if (platform === 'youtube') profileUrl = 'https://www.youtube.com/@' + username;
  else return { success: false, error: 'Plataforma nao suportada: ' + platform };

  var res = await fetch(BASE + '/screenshot?token=' + BROWSERLESS_KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: profileUrl,
      options: { type: 'jpeg', quality: 40, fullPage: false, width: 800, height: 600 },
    }),
  });

  var exists = res.ok;
  var basicStats: any = { exists, username };

  if (exists) {
    var contentType = res.headers.get('content-type') || '';
    if (contentType.includes('image')) {
      var len = parseInt(res.headers.get('content-length') || '0');
      if (len < 5000) {
        basicStats.exists = false;
        basicStats.note = 'Pagina redireccionou para login — conta pode ser privada ou inexistente';
      }
    }

    try {
      var contentRes = await fetch(BASE + '/content?token=' + BROWSERLESS_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: profileUrl,
          elements: [
            { selector: 'title', attribute: 'textContent' },
            { selector: 'meta[name="description"]', attribute: 'content' },
          ],
        }),
      });
      if (contentRes.ok) {
        var cjson = await contentRes.json();
        var cdata = cjson.data || cjson;
        if (Array.isArray(cdata)) {
          for (var i = 0; i < cdata.length; i++) {
            if (cdata[i].type === 'title') basicStats.pageTitle = cdata[i].value;
            if (cdata[i].name === 'description') basicStats.pageDescription = cdata[i].value;
          }
        }
      }
    } catch (e: any) {
      console.error('Content fetch falhou:', e.message);
    }
  }

  return { success: true, data: basicStats };
}

// ── main handler ───────────────────────────────────────────

export async function POST(request: Request) {
  try {
    var body = await request.json().catch(function () { return {}; });
    var action = body.action || '';

    if (action === 'screenshot') {
      if (!body.url) return NextResponse.json({ success: false, error: 'URL necessario' });
      var result = await screenshot(body.url, body.options || {});
      return NextResponse.json(result);
    }

    if (action === 'scrape') {
      if (!body.url) return NextResponse.json({ success: false, error: 'URL necessario' });
      var scraped = await scrape(body.url, body.selector || '');
      return NextResponse.json(scraped);
    }

    if (action === 'extract_profile') {
      if (!body.platform || !body.username) {
        return NextResponse.json({ success: false, error: 'Plataforma e username sao obrigatorios' });
      }
      var profile = await extractProfile(body.platform, body.username);
      return NextResponse.json(profile);
    }

    if (action === 'check_account') {
      if (!body.platform || !body.username) {
        return NextResponse.json({ success: false, error: 'Plataforma e username sao obrigatorios' });
      }
      var account = await checkAccount(body.platform, body.username);
      return NextResponse.json(account);
    }

    return NextResponse.json({ success: false, error: 'Accao desconhecida: ' + action });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
