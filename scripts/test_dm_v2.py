#!/usr/bin/env python3
"""Test IG login + IG DM + FB DM on deployed Aura."""
import json, requests, base64, sys

BASE = "https://aura-social-engine-production.up.railway.app"

def login():
    r = requests.post(f"{BASE}/api/auth", json={"password": "Jarvis99!"}, timeout=15)
    return r.json().get('token', '')

def api(token, action, extra=None):
    p = {"action": action}
    if extra: p.update(extra)
    r = requests.post(f"{BASE}/cmd/cold-dm", headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"}, json=p, timeout=180)
    return r.json()

token = login()
print(f"Auth OK")

# 1. IG LOGIN (re-login since cookies may have been cleared)
print("\n=== 1. IG Login ===")
r = api(token, "login_ig", {"username": "jesuaine07", "password": "X2VpFZY@)u-H%89"})
print(f"IG Login: {'PASS' if r.get('success') else 'FAIL'}")
if not r.get('success'):
    print(f"  Error: {r.get('error')}")
    if r.get('debug', {}).get('page_text'):
        print(f"  Page: {r['debug']['page_text'][:200]}")
    sys.exit(1)

# 2. IG COLD DM
print("\n=== 2. IG Cold DM ===")
r = api(token, "send_ig", {
    "username": "mwango.brain",
    "message": "Ola! Vi o perfil da Mwango Brain e gostava de conversar sobre servicos de gestao de redes sociais. Tens disponibilidade para uma conversa rapida?"
})
print(f"Success: {r.get('success')}")
print(f"Debug: {r.get('debug')}")
if r.get('error'): print(f"Error: {r['error']}")
if r.get('screenshot'):
    img = base64.b64decode(r['screenshot'])
    with open('/home/z/my-project/download/ig-dm.png', 'wb') as f: f.write(img)
    print(f"Screenshot saved ({len(img)} bytes)")

# 3. FB COLD DM (usar pagina publica)
print("\n=== 3. FB Cold DM ===")
r = api(token, "send_fb", {
    "target": "people/Jarvis-v3/61592889410106/",
    "message": "Ola! Aqui e da equipa da Mwango Brain. Gostariamos de falar contigo sobre uma oportunidade."
})
print(f"Success: {r.get('success')}")
print(f"Debug: {r.get('debug')}")
if r.get('error'): print(f"Error: {r['error']}")
if r.get('screenshot'):
    img = base64.b64decode(r['screenshot'])
    with open('/home/z/my-project/download/fb-dm.png', 'wb') as f: f.write(img)
    print(f"Screenshot saved ({len(img)} bytes)")
