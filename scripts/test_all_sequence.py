#!/usr/bin/env python3
"""Test FB login + IG DM + FB DM sequentially on deployed Aura."""
import json
import requests
import base64
import sys

BASE_URL = "https://aura-social-engine-production.up.railway.app"

def login():
    resp = requests.post(f"{BASE_URL}/api/auth", json={"password": "Jarvis99!"}, timeout=15)
    return resp.json().get('token', '')

def api(token, action, extra=None):
    payload = {"action": action}
    if extra:
        payload.update(extra)
    resp = requests.post(
        f"{BASE_URL}/cmd/cold-dm",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=payload,
        timeout=180,
    )
    return resp.json()

token = login()
if not token:
    print("LOGIN FAILED"); sys.exit(1)
print(f"Auth OK")

# ===== 1. FB LOGIN =====
print("\n" + "="*60)
print("TEST 1: Facebook Login")
print("="*60)
result = api(token, "login_fb", {
    "email": "+244925049405",
    "password": "Jesus888@"
})
print(json.dumps(result, indent=2, default=str))
if result.get('debug', {}).get('screenshot'):
    img = base64.b64decode(result['debug']['screenshot'])
    with open('/home/z/my-project/download/fb-login.png', 'wb') as f:
        f.write(img)
    print(f"Screenshot: download/fb-login.png ({len(img)} bytes)")

fb_ok = result.get('success', False)

# ===== 2. IG COLD DM =====
print("\n" + "="*60)
print("TEST 2: Instagram Cold DM")
print("="*60)
# Test with a public account - use mwango-brain or similar
result = api(token, "send_ig", {
    "username": "mwango.brain",
    "message": "Oi! Sou o assistente da Mwango Brain. Vi o teu perfil e gostaria de conversar sobre oportunidades. Tens um minuto?"
})
print(json.dumps(result, indent=2, default=str))
if result.get('screenshot'):
    img = base64.b64decode(result['screenshot'])
    with open('/home/z/my-project/download/ig-dm-result.png', 'wb') as f:
        f.write(img)
    print(f"Screenshot: download/ig-dm-result.png ({len(img)} bytes)")

ig_dm_ok = result.get('success', False)

# ===== 3. FB COLD DM =====
print("\n" + "="*60)
print("TEST 3: Facebook Cold DM")
print("="*60)
if fb_ok:
    result = api(token, "send_fb", {
        "target": "mwango.brain.7",
        "message": "Ola! Aqui e da Mwango Brain. Gostariamos de falar contigo sobre uma oportunidade. Tens disponibilidade?"
    })
    print(json.dumps(result, indent=2, default=str))
    if result.get('screenshot'):
        img = base64.b64decode(result['screenshot'])
        with open('/home/z/my-project/download/fb-dm-result.png', 'wb') as f:
            f.write(img)
        print(f"Screenshot: download/fb-dm-result.png ({len(img)} bytes)")
    fb_dm_ok = result.get('success', False)
else:
    print("SKIPPED — FB login failed")
    fb_dm_ok = False

# ===== SUMMARY =====
print("\n" + "="*60)
print("SUMMARY")
print("="*60)
print(f"FB Login:     {'PASS' if fb_ok else 'FAIL'}")
print(f"IG Cold DM:   {'PASS' if ig_dm_ok else 'FAIL'}")
print(f"FB Cold DM:   {'PASS' if fb_dm_ok else 'FAIL'}")
