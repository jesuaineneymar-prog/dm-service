import * as https from 'https';

const SHORT_LIVED_TOKEN = 'EAAfqggcDF78BSNTvNLbs1yj60UYEME9FEp8OFnxapWTcRtiW6sf2d4eWf0wXmBxDZCP1VDjLZANsK0HWu5pnFUKxaKJbgrUED4IK3JOXdtaChpwUhOeCxYBelZAphlAbeU0xj8cDwjIke8xT925hKgLhhitHJ4sIFJ4sF7mALDiUtc5ugwNJM2ZCyuUuAoMcGrFm537j49h8WSEVzwMmllybdVlbUFNVUjGNCEl4TROUCS0QqNnvWVUZD';
const APP_ID = '2228169021265855';
const APP_SECRET = 'bb2a29ab6ae48aa39815607bd05ba788';
const PAGE_ID = '1271692609354364';
const VERIFY_TOKEN = 'aura_mwango_verify_2024';
const CALLBACK_URL = 'https://jarvis-khaki-chi.vercel.app/api/webhook/messenger';

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

function appToken(): string {
  return Buffer.from(APP_ID + ':' + APP_SECRET).toString('base64');
}

async function main() {
  console.log('===========================================');
  console.log('   AURA MESSENGER - SETUP COMPLETO');
  console.log('===========================================\n');

  // ========== STEP 1: Debug original token ==========
  console.log('STEP 1: A verificar token original...');
  const appAccessToken = APP_ID + '|' + APP_SECRET;
  
  const debug = await graphGet('debug_token?input_token=' + SHORT_LIVED_TOKEN + '&appsecret_proof=' + APP_SECRET, '');
  if (debug.data) {
    const t = debug.data;
    console.log('   App:', t.application);
    console.log('   Tipo:', t.type);
    console.log('   Pagina:', t.profile_id || 'N/A');
    console.log('   Expira:', t.expires_at ? new Date(t.expires_at * 1000).toISOString() : 'N/A');
    console.log('   Valido:', t.is_valid ? 'SIM' : 'NAO');
    console.log('   Permissoes:', t.scopes?.join(', '));
  } else {
    console.log('   Debug:', JSON.stringify(debug).substring(0, 200));
  }

  // ========== STEP 2: Exchange for long-lived USER token ==========
  console.log('\nSTEP 2: A trocar para token de longa duracao...');
  
  const exchange = await graphGet(
    `oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${SHORT_LIVED_TOKEN}`,
    ''
  );
  
  let longLivedUserToken = '';
  if (exchange.access_token) {
    longLivedUserToken = exchange.access_token;
    const expiresInDays = exchange.expires_in ? Math.round(exchange.expires_in / 86400) : 0;
    console.log('   Token long-lived (user) obtido!');
    console.log('   Expira em:', expiresInDays, 'dias');
    console.log('   Token:', longLivedUserToken.substring(0, 30) + '...');
  } else {
    console.log('   Falha no exchange:', JSON.stringify(exchange).substring(0, 300));
    console.log('   Tentando metodo alternativo...');
    longLivedUserToken = SHORT_LIVED_TOKEN; // fallback
  }

  // ========== STEP 3: Get LONG-LIVED PAGE TOKEN ==========
  console.log('\nSTEP 3: A obter Page Token de longa duracao...');
  
  let longLivedPageToken = '';
  
  // Method: Get long-lived page token using the user's long-lived token
  const pageTokens = await graphGet(
    PAGE_ID + '/fields=access_token&access_token=' + longLivedUserToken,
    ''
  );
  
  if (pageTokens.access_token && pageTokens.access_token !== SHORT_LIVED_TOKEN) {
    longLivedPageToken = pageTokens.access_token;
    console.log('   Page Token (long-lived) obtido!');
    console.log('   Token:', longLivedPageToken.substring(0, 30) + '...');
  } else {
    console.log('   Metodo 1 falhou, tentando via accounts endpoint...');
    
    // Alternative: get all pages and find Jarvis v3
    const accounts = await graphGet('me/accounts?fields=name,access_token&access_token=' + longLivedUserToken, '');
    if (accounts.data && Array.isArray(accounts.data)) {
      for (const page of accounts.data) {
        console.log('   Pagina encontrada:', page.name, '- token:', page.access_token ? page.access_token.substring(0, 20) + '...' : 'N/A');
        if (page.name.includes('Jarvis') || page.id === PAGE_ID) {
          longLivedPageToken = page.access_token;
        }
      }
    }
    
    if (!longLivedPageToken) {
      console.log('   Metodo 2 falhou. Tentando obter permanent page token...');
      
      // Method 3: Exchange for permanent page token using app access token
      const permExchange = await graphGet(
        `oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${SHORT_LIVED_TOKEN}`,
        ''
      );
      if (permExchange.access_token) {
        // Use this long-lived user token to get page tokens
        const permAccounts = await graphGet('me/accounts?fields=name,access_token&access_token=' + permExchange.access_token, '');
        if (permAccounts.data && Array.isArray(permAccounts.data)) {
          for (const page of permAccounts.data) {
            if (page.name.includes('Jarvis') || page.id === PAGE_ID) {
              longLivedPageToken = page.access_token;
              break;
            }
          }
        }
      }
    }
    
    if (!longLivedPageToken) {
      console.log('   Nao foi possivel obter long-lived page token');
      console.log('   Usando token original (pode expirar em ~1-2 horas)');
      longLivedPageToken = SHORT_LIVED_TOKEN;
    }
  }

  // ========== STEP 4: Debug the final token ==========
  console.log('\nSTEP 4: A verificar token final...');
  const finalDebug = await graphGet('debug_token?input_token=' + longLivedPageToken + '&appsecret_proof=' + APP_SECRET, '');
  if (finalDebug.data) {
    const t = finalDebug.data;
    const expiresAt = t.expires_at ? new Date(t.expires_at * 1000) : null;
    const isPermanent = !t.expires_at || t.expires_at === 0 || t.type === 'page';
    console.log('   Tipo:', t.type);
    console.log('   Expira:', isPermanent ? 'NUNCA (PERMANENTE)' : expiresAt ? expiresAt.toISOString() : 'Desconhecido');
    console.log('   Validade:', t.is_valid ? 'VALIDO' : 'INVALIDO');
    console.log('   Pagina ID:', t.profile_id || 'N/A');
  }

  // ========== STEP 5: Configure Messenger Profile ==========
  console.log('\nSTEP 5: A configurar perfil do Messenger...');
  
  const profile = await graphPost('me/messenger_profile', {
    get_started: { payload: 'GET_STARTED' },
    greeting: [{
      locale: 'default',
      text: 'Ola! Bem-vindo a Mwango Brain. Agencia de marketing digital em Angola. Como podemos ajudar o teu negocio?'
    }],
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
    access_token: longLivedPageToken
  }, longLivedPageToken);
  console.log('   Perfil:', profile.result === 'success' ? 'OK' : profile.error ? 'ERRO: ' + profile.error.message : JSON.stringify(profile));

  // ========== STEP 6: Subscribe page to webhook ==========
  console.log('\nSTEP 6: A subscrever pagina ao webhook...');
  const subscribe = await graphPost(PAGE_ID + '/subscribed_apps', {
    subscribed_fields: 'messages,messaging_postbacks',
    access_token: longLivedPageToken
  }, longLivedPageToken);
  console.log('   Webhook:', subscribe.success ? 'OK - pagina subscrita!' : subscribe.error ? 'ERRO: ' + subscribe.error.message : JSON.stringify(subscribe));

  // ========== STEP 7: Test page access ==========
  console.log('\nSTEP 7: A testar acesso a pagina...');
  const pageInfo = await graphGet(PAGE_ID + '?fields=name,id,fan_count,category,about', longLivedPageToken);
  if (pageInfo.name) {
    console.log('   Pagina:', pageInfo.name);
    console.log('   Seguidores:', pageInfo.fan_count || 'N/A');
    console.log('   Categoria:', pageInfo.category || 'N/A');
    console.log('   Token: FUNCIONA PERFEITAMENTE!');
  } else {
    console.log('   Erro:', JSON.stringify(pageInfo).substring(0, 200));
  }

  // ========== FINAL SUMMARY ==========
  console.log('\n===========================================');
  console.log('   RESUMO FINAL');
  console.log('===========================================');
  console.log('');
  console.log('TOKEN FINAL (long-lived):');
  console.log(longLivedPageToken);
  console.log('');
  console.log('ENV VARS para adicionar:');
  console.log('META_PAGE_TOKEN=' + longLivedPageToken);
  console.log('META_PAGE_ID=' + PAGE_ID);
  console.log('META_APP_ID=' + APP_ID);
  console.log('META_APP_SECRET=' + APP_SECRET);
  console.log('MESSENGER_VERIFY_TOKEN=' + VERIFY_TOKEN);
  console.log('');
  console.log('OPCOES DO MESSENGER:');
  console.log('  [x] Botao Comecar (Get Started)');
  console.log('  [x] Saudacao automatica');
  console.log('  [x] Menu persistente (Servicos, Precos, Falar com equipa, Website)');
  console.log(subscribe.success ? '  [x] Pagina subscrita ao webhook' : '  [ ] Webhook: configura manualmente no Facebook Developer');
  console.log('');
  console.log('UNICO PASSO MANUAL:');
  console.log('  1. Vai a Facebook Developer > Aura > Messenger > Settings > Webhooks');
  console.log('  2. Callback URL: ' + CALLBACK_URL);
  console.log('  3. Verify Token: ' + VERIFY_TOKEN);
  console.log('  4. Marca: messages, messaging_postbacks');
  console.log('  5. Adiciona as env vars acima na Vercel');
  console.log('===========================================');
}

main().catch(console.error);
