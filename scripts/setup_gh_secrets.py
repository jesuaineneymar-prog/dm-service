import json, base64, subprocess, urllib.request, ssl, sys
from nacl import encoding, public

# Get GitHub token from git config
result = subprocess.run(['git', 'config', '--get', 'remote.origin.url'], capture_output=True, text=True)
url = result.stdout.strip()
token = url.replace('https://', '').split('@')[0]
repo = 'jesuaineneymar-prog/dm-service'

print(f'Token length: {len(token)}')
print(f'Repo: {repo}')

# Get public key for encryption
req = urllib.request.Request(f'https://api.github.com/repos/{repo}/actions/secrets/public-key')
req.add_header('Authorization', f'token {token}')
req.add_header('Accept', 'application/vnd.github.v3+json')
ctx = ssl.create_default_context()

try:
    resp = urllib.request.urlopen(req, context=ctx)
    pub_data = json.loads(resp.read())
except urllib.error.HTTPError as e:
    print(f'Error getting public key: {e.code} {e.read().decode()[:200]}')
    sys.exit(1)

key_b64 = pub_data['key']
key_id = pub_data['key_id']
print(f'Public key ID: {key_id}')

pub_key = public.PublicKey(base64.b64decode(key_b64))
sealed = public.SealedBox(pub_key)

def set_secret(name: str, value: str):
    encrypted = base64.b64encode(sealed.encrypt(value.encode())).decode()
    body = json.dumps({'encrypted_value': encrypted, 'key_id': key_id}).encode()
    req = urllib.request.Request(
        f'https://api.github.com/repos/{repo}/actions/secrets/{name}',
        data=body,
        method='PUT'
    )
    req.add_header('Authorization', f'token {token}')
    req.add_header('Content-Type', 'application/json')
    try:
        urllib.request.urlopen(req, context=ctx)
        print(f'Secret {name} = OK')
    except urllib.error.HTTPError as e:
        print(f'Error setting {name}: {e.code} {e.read().decode()[:200]}')

set_secret('JARVIS_URL', 'https://jarvis-khaki-chi.vercel.app')
set_secret('CRONS_SECRET', 'jarvis_cron_secret_mwango_2024')
print('\nDone!')
