#!/usr/bin/env python3
"""Test IG login via Bright Data on deployed Aura."""
import json
import requests

BASE_URL = "https://aura-social-engine-production.up.railway.app"

# Login
login_resp = requests.post(f"{BASE_URL}/api/auth", json={"password": "Jarvis99!"}, timeout=15)
token = login_resp.json().get('token', '')
print(f"Token OK: {token[:30]}...")

# Test IG Login
print("\n=== IG Login via Bright Data ===")
resp = requests.post(
    f"{BASE_URL}/cmd/cold-dm",
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    json={
        "action": "login_ig",
        "username": "jesuaine07",
        "password": "X2VpFZY@)u-H%89"
    },
    timeout=120
)
print(f"Status: {resp.status_code}")
try:
    data = resp.json()
    print(json.dumps(data, indent=2))
except:
    print(f"Body: {resp.text[:1000]}")
