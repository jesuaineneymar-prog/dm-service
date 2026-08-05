import { NextResponse } from 'next/server';
import { META_PAGE_TOKEN } from '@/lib/config';

// POST /api/messenger-setup — Set up Messenger webhook and get_started button
export async function POST(request: Request) {
  var body = await request.json().catch(() => ({}));
  var pageToken = body.page_token || META_PAGE_TOKEN || '';
  if (!pageToken) {
    return NextResponse.json({ success: false, error: 'META_PAGE_TOKEN necessario' });
  }

  var results: any = {};

  // 1. Set Get Started button
  try {
    var gsRes = await fetch('https://graph.facebook.com/v21.0/me/messenger_profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        get_started: { payload: 'GET_STARTED' },
        access_token: pageToken
      })
    });
    var gsData = await gsRes.json();
    results.getStarted = gsData.error ? 'Failed: ' + gsData.error.message : 'OK';
  } catch(e: any) {
    results.getStarted = 'Error: ' + e.message;
  }

  // 2. Set Greeting text
  try {
    var grRes = await fetch('https://graph.facebook.com/v21.0/me/messenger_profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        greeting: [{
          locale: 'default',
          text: 'Ola! Bem-vindo a Mwango Brain. Como podemos ajudar?'
        }],
        access_token: pageToken
      })
    });
    var grData = await grRes.json();
    results.greeting = grData.error ? 'Failed: ' + grData.error.message : 'OK';
  } catch(e: any) {
    results.greeting = 'Error: ' + e.message;
  }

  // 3. Set Persistent Menu
  try {
    var pmRes = await fetch('https://graph.facebook.com/v21.0/me/messenger_profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        persistent_menu: [{
          locale: 'default',
          composer_input_disabled: false,
          call_to_actions: [
            { type: 'postback', title: 'Servicos', payload: 'SERVICOS' },
            { type: 'postback', title: 'Precos', payload: 'PRECOS' },
            { type: 'postback', title: 'Falar com equipa', payload: 'HUMANO' },
            { type: 'web_url', title: 'Website', url: 'https://mwangobrain.com' }
          ]
        }],
        access_token: pageToken
      })
    });
    var pmData = await pmRes.json();
    results.persistentMenu = pmData.error ? 'Failed: ' + pmData.error.message : 'OK';
  } catch(e: any) {
    results.persistentMenu = 'Error: ' + e.message;
  }

  return NextResponse.json({ success: true, results });
}

// GET /api/messenger-setup — Check current Messenger profile
export async function GET() {
  var pageToken = META_PAGE_TOKEN || '';
  if (!pageToken) {
    return NextResponse.json({ success: false, error: 'META_PAGE_TOKEN necessario' });
  }

  try {
    var res = await fetch('https://graph.facebook.com/v21.0/me/messenger_profile?fields=get_started,greeting,persistent_menu&access_token=' + pageToken);
    var data = await res.json();
    return NextResponse.json({ success: true, data });
  } catch(e: any) {
    return NextResponse.json({ success: false, error: e.message });
  }
}
