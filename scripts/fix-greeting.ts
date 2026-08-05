import * as https from 'https';

const PAGE_TOKEN = process.argv[2] || '';
const PAGE_ID = '1271692609354364';

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
  // Fix: set greeting + get_started together
  console.log('Configurando saudacao + get_started + menu...');
  
  const profile = await graphPost('me/messenger_profile', {
    get_started: { payload: 'GET_STARTED' },
    greeting: [{
      locale: 'default',
      text: 'Ola! Bem-vindo a Mwango Brain. Somos uma agencia de marketing digital em Angola. Como podemos ajudar o teu negocio?'
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
    access_token: PAGE_TOKEN
  }, PAGE_TOKEN);

  console.log('Resultado:', JSON.stringify(profile, null, 2));
}

main().catch(console.error);
