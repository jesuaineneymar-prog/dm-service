import * as https from 'https';

const PAGE_TOKEN = process.argv[2] || '';
const APP_ID = process.argv[3] || '';
const APP_SECRET = process.argv[4] || '';
const PAGE_ID = '1271692609354364';
const CALLBACK_URL = 'https://jarvis-khaki-chi.vercel.app/api/webhook/messenger';
const VERIFY_TOKEN = 'aura_mwango_verify_2024';

function graphGet(path: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `https://graph.facebook.com/v21.0/${path}&access_token=${token}`;
    https.get(url, { rejectUnauthorized: false }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve({ raw: data }); }
      });
    }).on('error', reject);
  });
}

function graphPost(path: string, body: any, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const url = new URL(`https://graph.facebook.com/v21.0/${path}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      rejectUnauthorized: false,
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('=== AURA MESSENGER SETUP ===\n');

  // Step 1: Debug the token
  console.log('1. A verificar token...');
  const debug = await graphGet('debug_token?input_token=' + PAGE_TOKEN, '');
  if (debug.data) {
    const t = debug.data;
    console.log('   Tipo:', t.type);
    console.log('   App ID:', t.app_id);
    console.log('   Page ID:', t.profile_id || 'N/A');
    console.log('   Expira em:', t.expires_at ? new Date(t.expires_at * 1000).toISOString() : 'Nunca (long-lived)');
    console.log('   Validade:', t.is_valid ? 'VALIDO' : 'INVALIDO');
    console.log('   Permissoes:', t.scopes?.join(', '));
  } else {
    console.log('   Debug result:', JSON.stringify(debug).substring(0, 300));
  }

  // Step 2: Exchange for long-lived page token
  console.log('\n2. A trocar por token de longa duracao...');
  let longLivedToken = PAGE_TOKEN;

  if (APP_ID && APP_SECRET) {
    // Exchange short-lived page token for long-lived
    const exchange = await graphGet(
      `oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${PAGE_TOKEN}`,
      ''
    );
    if (exchange.access_token) {
      longLivedToken = exchange.access_token;
      console.log('   NOVO TOKEN (long-lived):', longLivedToken.substring(0, 20) + '...');
      console.log('   Expira em:', exchange.expires_in ? Math.round(exchange.expires_in / 86400) + ' dias' : 'desconhecido');

      // Debug the new token
      const debugNew = await graphGet('debug_token?input_token=' + longLivedToken, '');
      if (debugNew.data) {
        console.log('   Confirmado - expira:', debugNew.data.expires_at ? new Date(debugNew.data.expires_at * 1000).toISOString() : 'Nunca');
      }
    } else {
      console.log('   Exchange falhou:', JSON.stringify(exchange).substring(0, 200));
      console.log('   A usar token original...');
    }
  } else {
    console.log('   Sem APP_ID/APP_SECRET - a tentar get long-lived page token directo...');

    // Try getting long-lived page token using the page token directly
    // First, get the user access token from the page token's app
    const exchange = await graphGet(
      `oauth/access_token?grant_type=fb_exchange_token&client_id=${debug.data?.app_id || ''}&client_secret=${APP_SECRET}&fb_exchange_token=${PAGE_TOKEN}`,
      ''
    );
    if (exchange.access_token) {
      longLivedToken = exchange.access_token;
      console.log('   Token long-lived obtido!');
    } else {
      console.log('   Nao foi possivel obter long-lived token sem APP_ID e APP_SECRET');
      console.log('   O token actual pode ser short-lived. Vamos continuar...');
    }
  }

  // Step 3: Set Get Started button
  console.log('\n3. A configurar botao "Comecar"...');
  const getStarted = await graphPost('me/messenger_profile', {
    get_started: { payload: 'GET_STARTED' },
    access_token: longLivedToken
  }, longLivedToken);
  console.log('   Resultado:', getStarted.error ? 'ERRO: ' + getStarted.error.message : 'OK');

  // Step 4: Set Greeting
  console.log('\n4. A configurar saudacao...');
  const greeting = await graphPost('me/messenger_profile', {
    greeting: [{
      locale: 'default',
      text: 'Ola! Bem-vindo a Mwango Brain. Somos uma agencia de marketing digital em Angola. Como podemos ajudar o teu negocio?'
    }],
    access_token: longLivedToken
  }, longLivedToken);
  console.log('   Resultado:', greeting.error ? 'ERRO: ' + greeting.error.message : 'OK');

  // Step 5: Set Persistent Menu
  console.log('\n5. A configurar menu persistente...');
  const menu = await graphPost('me/messenger_profile', {
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
    access_token: longLivedToken
  }, longLivedToken);
  console.log('   Resultado:', menu.error ? 'ERRO: ' + menu.error.message : 'OK');

  // Step 6: Subscribe the page to the webhook (if app_id available)
  if (APP_ID) {
    console.log('\n6. A subscrever pagina ao webhook...');
    const subscribe = await graphPost(`${PAGE_ID}/subscribed_apps`, {
      subscribed_fields: 'messages,messaging_postbacks',
      access_token: longLivedToken
    }, longLivedToken);
    console.log('   Resultado:', subscribe.error ? 'ERRO: ' + subscribe.error.message : 'OK - Pagina subscrita ao webhook');
  } else {
    console.log('\n6. Subscricao do webhook: necessitas de fazer manualmente no Facebook Developer');
  }

  // Step 7: Test the page token - get page info
  console.log('\n7. A testar acesso a pagina...');
  const pageInfo = await graphGet(PAGE_ID + '?fields=name,id,fan_count,category', longLivedToken);
  if (pageInfo.name) {
    console.log('   Pagina:', pageInfo.name);
    console.log('   Seguidores:', pageInfo.fan_count || 'N/A');
    console.log('   Categoria:', pageInfo.category || 'N/A');
    console.log('   Token FUNCIONA!');
  } else {
    console.log('   Erro:', JSON.stringify(pageInfo).substring(0, 200));
  }

  // Final summary
  console.log('\n=== RESUMO ===');
  console.log('Token configurado:', longLivedToken === PAGE_TOKEN ? 'ORIGINAL (nao trocado)' : 'LONG-LIVED (NOVO)');
  console.log('');
  console.log('ENV VAR para adicionar na Vercel/Railway:');
  console.log('META_PAGE_TOKEN=' + longLivedToken);
  console.log('META_PAGE_ID=' + PAGE_ID);
  console.log('');
  console.log('PASSO FINAL (manual):');
  console.log('1. Vai ao Facebook Developer > App > Messenger > Settings > Webhooks');
  console.log('2. Callback URL: ' + CALLBACK_URL);
  console.log('3. Verify Token: ' + VERIFY_TOKEN);
  console.log('4. Subscreve: messages, messaging_postbacks');
  console.log('5. Adiciona as env vars acima na Vercel');
}

main().catch(console.error);
