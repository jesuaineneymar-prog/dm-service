#!/usr/bin/env python3
"""Test IG with navigation and debugging."""
import json
import requests

BASE_URL = "https://aura-social-engine-production.up.railway.app"

login_resp = requests.post(f"{BASE_URL}/api/auth", json={"password": "Jarvis99!"}, timeout=15)
token = login_resp.json().get('token', '')

# Check status
print("=== Status ===")
resp = requests.post(
    f"{BASE_URL}/cmd/cold-dm",
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    json={"action": "status"},
    timeout=30
)
print(json.dumps(resp.json(), indent=2))
