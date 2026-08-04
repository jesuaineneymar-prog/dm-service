#!/usr/bin/env python3
"""Debug IG page via Bright Data on deployed Aura."""
import json
import requests
import base64

BASE_URL = "https://aura-social-engine-production.up.railway.app"

login_resp = requests.post(f"{BASE_URL}/api/auth", json={"password": "Jarvis99!"}, timeout=15)
token = login_resp.json().get('token', '')
print(f"Token OK")

# Debug IG
print("\n=== Debug Instagram ===")
resp = requests.post(
    f"{BASE_URL}/cmd/cold-dm",
    headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    json={"action": "debug_ig"},
    timeout=120
)
print(f"Status: {resp.status_code}")
data = resp.json()
print(json.dumps({k: v for k, v in data.items() if k != 'debug' or 'screenshot' not in v}, indent=2, default=str))

# Save screenshot if present
if data.get('debug', {}).get('screenshot'):
    screenshot_b64 = data['debug']['screenshot']
    img_data = base64.b64decode(screenshot_b64)
    with open('/home/z/my-project/download/ig-debug.png', 'wb') as f:
        f.write(img_data)
    print(f"\nScreenshot saved to download/ig-debug.png ({len(img_data)} bytes)")

# Print page text
if data.get('debug', {}).get('body_text'):
    print(f"\nPage text (first 600 chars):\n{data['debug']['body_text']}")
