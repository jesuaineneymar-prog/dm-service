#!/usr/bin/env python3
"""Test cold DMs with inline credentials."""
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

# 1. IG COLD DM (com credenciais inline)
print("\n=== 1. IG Cold DM (com creds inline) ===")
r = api(token, "send_ig", {
    "username": "mwango.brain",
    "message": "Ola! Vi o perfil e gostava de conversar sobre gestao de redes sociais. Tens disponibilidade?",
    "ig_username": "jesuaine07",
    "ig_password": "X2VpFZY@)u-H%89"
})
print(f"Success: {r.get('success')}")
if r.get('error'): print(f"Error: {r['error']}")
if r.get('debug'): print(f"Debug: {r['debug']}")
if r.get('screenshot'):
    img = base64.b64decode(r['screenshot'])
    with open('/home/z/my-project/download/ig-dm.png', 'wb') as f: f.write(img)
    print(f"Screenshot saved ({len(img)} bytes)")

# 2. FB COLD DM (com credenciais inline)
print("\n=== 2. FB Cold DM (com creds inline) ===")
r = api(token, "send_fb", {
    "target": "https://www.facebook.com/profile.php?id=100089568902455",
    "message": "Ola! Aqui e da Mwango Brain. Gostariamos de falar contigo sobre uma oportunidade.",
    "fb_email": "+244925049405",
    "fb_password": "Jesus888@"
})
print(f"Success: {r.get('success')}")
if r.get('error'): print(f"Error: {r['error']}")
if r.get('debug'): print(f"Debug: {r['debug']}")
if r.get('screenshot'):
    img = base64.b64decode(r['screenshot'])
    with open('/home/z/my-project/download/fb-dm.png', 'wb') as f: f.write(img)
    print(f"Screenshot saved ({len(img)} bytes)")
