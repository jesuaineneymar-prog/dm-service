#!/usr/bin/env python3
"""Test Bright Data connection on deployed Aura."""
import json
import requests

BASE_URL = "https://aura-social-engine-production.up.railway.app"

# Login
login_resp = requests.post(f"{BASE_URL}/api/auth", json={"password": "Jarvis99!"}, timeout=15)
token = login_resp.json().get('token', '')
print(f"Token: {token[:30]}...")

# Test Bright Data connection
print("\n=== Test Bright Data Connection ===")
resp = requests.post(
    f"{BASE_URL}/cmd/cold-dm",
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    json={"action": "test"},
    timeout=120
)
print(f"Status: {resp.status_code}")
print(f"Body: {resp.text[:1000]}")
try:
    print(json.dumps(resp.json(), indent=2))
except:
    pass
