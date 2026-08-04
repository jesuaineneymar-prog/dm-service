// ============================================================
//  JARVIS — Upload-Post.com Initial Setup
//  1. Create user profile "jarvis" (or reuse existing)
//  2. Generate OAuth connection URL (Instagram + Facebook + TikTok)
//  3. Print the URL for Jesuaine to open in browser
// ============================================================

const fs = require('fs');
const path = require('path');

// Load .env.local manually
const envPath = '/home/z/my-project/jarvis/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, '');
});

const UPLOADPOST_KEY = env.UPLOADPOST_KEY;
const UP_PROFILE = env.UP_PROFILE || 'jarvis';

if (!UPLOADPOST_KEY) {
  console.error('❌ UPLOADPOST_KEY missing in .env.local');
  process.exit(1);
}

const BASE = 'https://api.upload-post.com/api';

async function call(method, path, body) {
  const headers = {
    'Authorization': `Apikey ${UPLOADPOST_KEY}`,
    'Accept': 'application/json'
  };
  const opts = { method, headers };
  if (body) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  JARVIS — Upload-Post.com Setup & OAuth URL Generator');
  console.log('═══════════════════════════════════════════════════════\n');

  // Step 1: Check account info
  console.log('▶ [1/4] A verificar a tua conta Upload-Post...');
  const me = await call('GET', '/uploadposts/me');
  console.log('  Status:', me.status);
  console.log('  Account:', JSON.stringify(me.json, null, 2).slice(0, 500));
  console.log('');

  // Step 2: Check if user profile "jarvis" already exists
  console.log(`▶ [2/4] A verificar se o perfil "${UP_PROFILE}" já existe...`);
  const profileCheck = await call('GET', `/uploadposts/users/${UP_PROFILE}`);
  if (profileCheck.status === 200 && profileCheck.json && !profileCheck.json.error) {
    console.log('  ✅ Perfil já existe!');
    console.log('  Connected accounts:', JSON.stringify(profileCheck.json.social_accounts || {}, null, 2));
  } else {
    console.log('  ℹ Perfil não existe, a criar...');
    const create = await call('POST', '/uploadposts/users', { username: UP_PROFILE });
    console.log('  Create status:', create.status);
    console.log('  Response:', JSON.stringify(create.json).slice(0, 300));
  }
  console.log('');

  // Step 3: Generate OAuth connection URL
  console.log('▶ [3/4] A gerar o link de conexão OAuth (IG + FB + TikTok)...');
  const jwtBody = {
    username: UP_PROFILE,
    redirect_url: 'https://jarvis-khaki-chi.vercel.app',
    platforms: ['instagram', 'facebook', 'tiktok'],
    connect_title: 'Mwango Brain — Conectar Redes Sociais ao JARVIS',
    logo_image: 'https://jarvis-khaki-chi.vercel.app/logo.png',
    language: 'pt'
  };
  const jwt = await call('POST', '/uploadposts/users/generate-jwt', jwtBody);
  console.log('  Status:', jwt.status);
  if (jwt.status === 200 && jwt.json && jwt.json.access_url) {
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  ✅ LINK DE CONEXÃO GERADO COM SUCESSO!');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('URL:', jwt.json.access_url);
    console.log('Validade:', jwt.json.duration || '48h');
    console.log('\nInstruções para o Jesuaine:');
    console.log('  1. Abre o link acima no navegador');
    console.log('  2. Vai ver 3 botões: Instagram, Facebook, TikTok');
    console.log('  3. Clica em cada um e faz login na página oficial');
    console.log('  4. Autoriza o Upload-Post a publicar em teu nome');
    console.log('  5. Quando os 3 estiverem conectados, avisa o JARVIS');
  } else {
    console.log('  ❌ Erro ao gerar URL:', JSON.stringify(jwt.json));
  }
  console.log('');

  // Step 4: List all profiles
  console.log('▶ [4/4] A listar perfis associados à conta...');
  const list = await call('GET', '/uploadposts/users');
  console.log('  Status:', list.status);
  console.log('  Profiles:', JSON.stringify(list.json, null, 2).slice(0, 800));
}

main().catch(e => {
  console.error('Erro fatal:', e);
  process.exit(1);
});
