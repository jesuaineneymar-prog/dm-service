const nacl = require('tweetnacl');
const http = require('http');
const crypto = require('crypto');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// NaCl sealed box using tweetnacl
function naclSeal(msg, recipientPk) {
  const ephemeral = nacl.box.keyPair();
  const nonce = new Uint8Array(nacl.hash(Buffer.concat([ephemeral.publicKey, recipientPk])).slice(0, 24));
  const encrypted = nacl.box(msg, nonce, recipientPk, ephemeral.secretKey);
  return Buffer.concat([ephemeral.publicKey, encrypted]);
}

function envelopeEncrypt(keyId, pubKeyHex, password, timestamp) {
  const pubKey = Buffer.from(pubKeyHex, 'hex');
  const pwdBytes = Buffer.from(password, 'utf-8');
  const tsBytes = Buffer.from(String(timestamp), 'utf-8');
  const AES_KEY = 32, TAG = 16, SEALED_OH = 48;
  const headerLen = 1 + 1 + 2 + AES_KEY + SEALED_OH + TAG;
  const out = Buffer.alloc(headerLen + pwdBytes.length);
  let S = 0;
  
  out[S] = 1; S++; // version
  out[S] = keyId & 0xff; S++; // keyId
  
  const aesKey = crypto.randomBytes(32);
  const sealed = naclSeal(aesKey, pubKey); // 32 + 32 + 16 = 80 bytes
  
  out[S] = sealed.length & 0xff; out[S+1] = (sealed.length >> 8) & 0xff; S += 2;
  sealed.copy(out, S); S += AES_KEY + SEALED_OH;
  
  // AES-GCM encrypt password
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, Buffer.alloc(12));
  cipher.setAAD(tsBytes);
  const ct = Buffer.concat([cipher.update(pwdBytes), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  tag.copy(out, S); S += TAG;
  ct.copy(out, S);
  
  return `#PWD_INSTAGRAM_BROWSER:10:${timestamp}:${out.toString('base64')}`;
}

function doReq(url, headers, method, body) {
  return new Promise((ok, fail) => {
    const h = Object.assign({}, headers||{}, {Host:'www.instagram.com'});
    const req = http.request({hostname:'181.39.25.196',port:8118,path:url,method:method||'GET',headers:h,timeout:15000}, res => {
      let d=[];res.on('data',c=>d.push(c));res.on('end',()=>ok({s:res.statusCode,b:Buffer.concat(d).toString(),ck:res.headers['set-cookie']||[]}));
    });
    req.on('error',fail);req.on('timeout',()=>{req.destroy();fail(new Error('t'));});
    if(body) req.write(body); req.end();
  });
}
function parseCk(cks) { var c={}; for(var ck of cks){var p=ck.split(';')[0].split('=');if(p.length>=2)c[p[0].trim()]=p.slice(1).join('=').trim();} return c; }
function ckStr(c) { return Object.entries(c).filter(e=>e[1]).map(e=>e[0]+'='+e[1]).join('; '); }

async function main() {
  const PUB = '6b62ab43a2f39c28917b076c9f81daff0c1c6e51f37d07f72ef2015433f03b02';
  const TS = Math.floor(Date.now()/1000);
  
  var r1 = await doReq('https://www.instagram.com/accounts/login/', {'User-Agent':UA});
  var ck = parseCk(r1.ck);
  var r2 = await doReq('https://www.instagram.com/data/shared_data/', {'User-Agent':UA,'Cookie':ckStr(ck)});
  Object.assign(ck, parseCk(r2.ck));
  var cfg={}; try{cfg=JSON.parse(r2.b);}catch(e){}
  var csrf = cfg.config?.csrf_token || ck.csrftoken || '';
  
  var enc = envelopeEncrypt(124, PUB, '9adJpLRGPX#YGx$', TS);
  console.log('Encrypted:', enc.length, 'chars');
  
  var body = 'username=jesuainecristiano78&enc_password=' + encodeURIComponent(enc) + '&queryParams=%7B%7D&optIntoOneTap=false&stopDeletion=false&trustedDeviceRecords=%7B%7D';
  var r3 = await doReq('https://www.instagram.com/accounts/login/ajax/', {
    'Content-Type':'application/x-www-form-urlencoded',
    'X-CSRFToken':csrf,'X-Instagram-Ajax':'1','X-IG-App-ID':'936619743392459',
    'X-IG-WWW-Claim':'0','X-Requested-With':'XMLHttpRequest',
    'Cookie':ckStr(ck),'User-Agent':UA,
    'Origin':'https://www.instagram.com','Referer':'https://www.instagram.com/accounts/login/',
    'sec-fetch-dest':'empty','sec-fetch-mode':'cors','sec-fetch-site':'same-origin',
    'x-asbd-id':'129477',
  }, 'POST', body);
  
  Object.assign(ck, parseCk(r3.ck));
  console.log('Status:', r3.s);
  console.log('Response:', r3.b);
  console.log('Session:', ck.sessionid ? 'SUCCESS: '+ck.sessionid.substring(0,20) : 'NONE');
  console.log('UserId:', ck.userid || 'NONE');
}

main().catch(e => console.log('Error:', e.message));
