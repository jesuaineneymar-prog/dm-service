#!/usr/bin/env python3
"""Test IG login with debug on deployed Aura."""
import json
import requests
import base64

BASE_URL = "https://aura-social-engine-production.up.railway.app"

login_resp = requests.post(f"{BASE_URL}/api/auth", json={"password": "Jarvis99!"}, timeout=15)
token = login_resp.json().get('token', '')
print(f"Token OK")

# Login IG
print("\n=== IG Login ===")
resp = requests.post(
    f"{BASE_URL}/cmd/cold-dm",
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    json={
        "action": "login_ig",
        "username": "jesuaine07",
        "password": "X2VpFZY@)u-H%89"
    },
    timeout=180
)
print(f"Status: {resp.status_code}")
data = resp.json()
print(f"Success: {data.get('success')}")
print(f"Error: {data.get('error', 'none')}")
print(f"Message: {data.get('message', 'none')}")

if data.get('debug'):
    debug = data['debug']
    print(f"\nFinal URL: {debug.get('final_url')}")
    print(f"Page text: {debug.get('page_text', '')[:400]}")
    if debug.get('screenshot'):
        img_data = base64.b64decode(debug['screenshot'])
        with open('/home/z/my-project/download/ig-login-result.png', 'wb') as f:
            f.write(img_data)
        print(f"Screenshot saved ({len(img_data)} bytes)")
