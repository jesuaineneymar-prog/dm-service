#!/usr/bin/env python3
"""Test cold-dm status on deployed Aura."""
import json
import requests

BASE_URL = "https://aura-social-engine-production.up.railway.app"

# Login
print("=== Login ===")
login_resp = requests.post(f"{BASE_URL}/api/auth", json={"password": "Jarvis99!"}, timeout=15)
print(f"Status: {login_resp.status_code}")
token = login_resp.json().get('token', '')
if not token:
    print("Login failed!")
    exit(1)
print(f"Got token: {token[:50]}...")

# Test cold-dm status
print("\n=== Cold DM Status ===")
resp = requests.post(
    f"{BASE_URL}/cmd/cold-dm",
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    json={"action": "status"},
    timeout=60
)
print(f"Status: {resp.status_code}")
print(json.dumps(resp.json(), indent=2))
