const nacl = require('tweetnacl');
const https = require('https');
const crypto = require('crypto');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function naclSeal(msg, pk) {
  const ep = nacl.box.keyPair();
  const nonce = new Uint8Array(nacl.hash(Buffer.concat([ep.publicKey, pk])).slice(0, 24));
  const enc = nacl.box(msg, nonce, pk, ep.secretKey);
  return Buffer.concat([ep.publicKey, enc]);
}

function envelopeEncrypt(kid, pubHex, pwd, ts) {
  const pubKey = Buffer.from(pubHex, 'hex');
  const pwdB = Buffer.from(pwd, 'utf-8');
  const tsB = Buffer.from(String(ts), 'utf-8');
  const AK=32,TG=16,SO=48;
  const hdr = 1+1+2+AK+SO+TG;
  const out = Buffer.alloc(hdr + pwdB.length);
  let S=0; out[S++]=1; out[S++]=kid&0xff;
  const aesK = crypto.randomBytes(32);
  const sealed = naclSeal(aesK, pubKey);
  out[S]=sealed.length&0xff; out[S+1]=(sealed.length>>8)&0xff; S+=2;
  sealed.copy(out,S); S+=AK+SO;
  const ci = crypto.createCipheriv('aes-256-gcm', aesK, Buffer.alloc(12));
  ci.setAAD(tsB);
  const ct = Buffer.concat([ci.update(pwdB), ci.final()]);
  const tag = ci.getAuthTag();
  tag.copy(out,S); S+=TG; ct.copy(out,S);
  return `#PWD_INSTAGRAM_BROWSER:10:${ts}:${out.toString('base64')}`;
}

function doGet(url, headers) {
  return new Promise((ok,fail)=>{
    const u=new URL(url);
    const req=https.request({hostname:u.hostname,path:u.pathname+u.search,method:'GET',headers:Object.assign({Host:u.hostname},headers),timeout:15000},res=>{
      let d=[];res.on('data',c=>d.push(c));res.on('end',()=>ok({s:res.statusCode,b:Buffer.concat(d).toString(),ck:res.headers['set-cookie']||[]}));
    });
    req.on('error',fail);req.on('timeout',()=>{req.destroy();fail(new Error('t'));});req.end();
  });
}
function doPost(url, headers, body) {
  return new Promise((ok,fail)=>{
    const u=new URL(url);
    const h=Object.assign({},headers,{Host:u.hostname});
    if(body) h['Content-Length']=Buffer.byteLength(body);
    const req=https.request({hostname:u.hostname,path:u.pathname+u.search,method:'POST',headers:h,timeout:15000},res=>{
      let d=[];res.on('data',c=>d.push(c));res.on('end',()=>ok({s:res.statusCode,b:Buffer.concat(d).toString(),ck:res.headers['set-cookie']||[]}));
    });
    req.on('error',fail);req.on('timeout',()=>{req.destroy();fail(new Error('t'));});
    if(body) req.write(body); req.end();
  });
}
function parseCk(cks){var c={};for(var ck of cks){var p=ck.split(';')[0].split('=');if(p.length>=2)c[p[0].trim()]=p.slice(1).join('=').trim();}return c;}
function ckStr(c){return Object.entries(c).filter(e=>e[1]).map(e=>e[0]+'='+e[1]).join('; ');}

async function main() {
  console.log('=== DIRECT (no proxy) with v10 encryption ===\n');
  
  var r1 = await doGet('https://www.instagram.com/accounts/login/', {'User-Agent':UA});
  var ck = parseCk(r1.ck);
  var r2 = await doGet('https://www.instagram.com/data/shared_data/', {'User-Agent':UA,'Cookie':ckStr(ck)});
  Object.assign(ck, parseCk(r2.ck));
  var cfg={}; try{cfg=JSON.parse(r2.b);}catch(e){}
  var csrf = cfg.config?.csrf_token || ck.csrftoken || '';
  console.log('CSRF:', csrf.substring(0,15));
  
  // Get encryption key from shared_data
  var encMatch = r2.b.match(/"public_key":"([a-f0-9]+)"/);
  var kidMatch = r2.b.match(/"key_id":"(\d+)"/);
  var verMatch = r2.b.match(/"version":"(\d+)"/);
  console.log('Key:', encMatch?encMatch[1].substring(0,20)+'...':'NOT FOUND');
  console.log('KeyID:', kidMatch?kidMatch[1]:'NOT FOUND');
  
  if (!encMatch) {
    // Try from HTML
    var html = await doGet('https://www.instagram.com/accounts/login/', {'User-Agent':UA});
    encMatch = html.b.match(/"public_key":"([a-f0-9]+)"/);
    kidMatch = html.b.match(/"key_id":"(\d+)"/);
    console.log('Key from HTML:', encMatch?encMatch[1].substring(0,20)+'...':'NOT FOUND');
  }
  
  var enc = envelopeEncrypt(124, '6b62ab43a2f39c28917b076c9f81daff0c1c6e51f37d07f72ef2015433f03b02', '9adJpLRGPX#YGx$', Math.floor(Date.now()/1000));
  
  var body = 'username=jesuainecristiano78&enc_password='+encodeURIComponent(enc)+'&queryParams=%7B%7D&optIntoOneTap=false&stopDeletion=false&trustedDeviceRecords=%7B%7D';
  var r3 = await doPost('https://www.instagram.com/accounts/login/ajax/', {
    'Content-Type':'application/x-www-form-urlencoded','X-CSRFToken':csrf,
    'X-Instagram-Ajax':'1','X-IG-App-ID':'936619743392459',
    'X-IG-WWW-Claim':'0','X-Requested-With':'XMLHttpRequest',
    'Cookie':ckStr(ck),'User-Agent':UA,
    'Origin':'https://www.instagram.com','Referer':'https://www.instagram.com/accounts/login/',
    'sec-fetch-dest':'empty','sec-fetch-mode':'cors','sec-fetch-site':'same-origin',
  }, body);
  
  Object.assign(ck, parseCk(r3.ck));
  console.log('\nStatus:', r3.s);
  console.log('Response:', r3.b.substring(0, 500));
  console.log('Session:', ck.sessionid?'YES':'NONE');
}

main().catch(e => console.log('Error:', e.message));
