#!/usr/bin/env python3
"""
Instagram Direct Login via HTTP API (no browser needed)
Uses Bright Data proxy for residential IP
Then sends DM via Instagram's web API
"""

import requests
import json
import time
import hashlib
import re
import sys

# Bright Data proxy
PROXY_HOST = "brd.superproxy.io"
PROXY_PORT = 80
PROXY_USER = "brd-customer-hl_97eb6daa-zone-aura"
PROXY_PASS = "5wnxr21qxi5x"

PROXIES = {
    "http": f"http://{PROXY_USER}:{PROXY_PASS}@{PROXY_HOST}:{PROXY_PORT}",
    "https": f"http://{PROXY_USER}:{PROXY_PASS}@{PROXY_HOST}:{PROXY_PORT}",
}

BASE_URL = "https://www.instagram.com"
API_URL = f"{BASE_URL}/api/v1"

session = requests.Session()
session.proxies = PROXIES
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
})

def enc_password(password: str) -> str:
    """Generate Instagram's enc_password format"""
    # Format: #PWD_INSTAGRAM_BROWSER:0:TIMESTAMP:HASH
    # Instagram uses a modified version. For web, the key is fixed.
    timestamp = str(int(time.time()))
    key = "iN4$aGr0m"
    # Simple XOR-based encryption (Instagram's web implementation)
    encoded = []
    for i, c in enumerate(password):
        key_c = key[i % len(key)]
        encoded.append(chr(ord(c) ^ ord(key_c)))
    encoded_str = ''.join(encoded).encode('utf-8').hex()
    return f"#PWD_INSTAGRAM_BROWSER:0:{timestamp}:{encoded_str}"

def step1_get_csrf_and_cookies():
    """GET instagram.com to get CSRF token and session cookies"""
    print("[1] Getting CSRF token and cookies...")
    resp = session.get(BASE_URL, timeout=30)
    print(f"    Status: {resp.status_code}")
    print(f"    Cookies: {dict(session.cookies)}")
    
    # Extract CSRF token from cookies
    csrftoken = session.cookies.get('csrftoken', '')
    if not csrftoken:
        # Try to extract from HTML
        match = re.search(r'"csrf_token":"([^"]+)"', resp.text)
        if match:
            csrftoken = match.group(1)
    print(f"    CSRF: {csrftoken[:10]}..." if csrftoken else "    CSRF: NOT FOUND")
    return csrftoken

def step2_login(username: str, password: str, csrftoken: str):
    """POST to Instagram login API"""
    print(f"[2] Logging in as {username}...")
    
    session.headers["X-CSRFToken"] = csrftoken
    session.headers["X-IG-App-ID"] = "936619743392459"
    session.headers["X-Instagram-AJAX"] = "1"
    session.headers["X-Requested-With"] = "XMLHttpRequest"
    session.headers["Content-Type"] = "application/x-www-form-urlencoded"
    session.headers["Referer"] = BASE_URL + "/"
    session.headers["Origin"] = BASE_URL
    
    login_data = {
        "username": username,
        "enc_password": enc_password(password),
        "queryParams": "{\"source\":\"nav\",\"next\":\"/\"}",
        "optIntoOneTap": "false",
        "stopDeletion": "false",
        "trustedDeviceRecords": "{}",
    }
    
    login_url = f"{API_URL}/accounts/login/ajax/1/"
    resp = session.post(login_url, data=login_data, timeout=30, allow_redirects=False)
    
    print(f"    Status: {resp.status_code}")
    print(f"    Response headers: {dict(resp.headers)}")
    
    try:
        data = resp.json()
        print(f"    Response: {json.dumps(data, indent=2)}")
        return data
    except:
        print(f"    Response text: {resp.text[:500]}")
        return {"status": "parse_error", "text": resp.text[:500]}

def step3_send_dm(recipient_username: str, message_text: str, csrftoken: str):
    """Send a DM via Instagram's web API"""
    print(f"[3] Sending DM to @{recipient_username}...")
    
    session.headers["X-CSRFToken"] = session.cookies.get('csrftoken', csrftoken)
    session.headers["X-IG-App-ID"] = "936619743392459"
    session.headers["Content-Type"] = "application/json"
    
    # Step 3a: Get recipient user ID
    print("    [3a] Getting user ID...")
    user_url = f"{API_URL}/users/web_profile_info/?username={recipient_username}"
    resp = session.get(user_url, timeout=30)
    
    if resp.status_code != 200:
        print(f"    Failed to get user info: {resp.status_code}")
        print(f"    Response: {resp.text[:300]}")
        return False
    
    user_data = resp.json()
    user_id = user_data["data"]["user"]["id"]
    print(f"    User ID: {user_id}")
    
    # Step 3b: Create/get thread
    print("    [3b] Creating thread...")
    thread_url = f"{API_URL}/direct_v2/web/create_thread/"
    thread_data = {
        "recipient_users": f"[[{user_id}]]",
        "text": message_text,
        "action": "send_item",
    }
    resp = session.post(thread_url, json=thread_data, timeout=30)
    
    print(f"    Thread response status: {resp.status_code}")
    try:
        thread_resp = resp.json()
        print(f"    Thread response: {json.dumps(thread_resp, indent=2)[:500]}")
        
        if thread_resp.get("thread_id") or thread_resp.get("status") == "ok":
            print(f"    DM SENT SUCCESSFULLY to @{recipient_username}!")
            return True
        else:
            # Try alternative: send to inbox
            print("    Thread creation may have failed, trying direct send...")
    except:
        print(f"    Thread response text: {resp.text[:300]}")
    
    # Step 3c: Alternative - send via broadcast endpoint
    print("    [3c] Trying broadcast endpoint...")
    broadcast_url = f"{API_URL}/direct_v2/web/send/broadcast/"
    broadcast_data = {
        "recipient_user_id": user_id,
        "thread_id": "0",
        "client_context": str(int(time.time() * 1000)),
        "text": message_text,
    }
    resp = session.post(broadcast_url, json=broadcast_data, timeout=30)
    print(f"    Broadcast status: {resp.status_code}")
    try:
        broadcast_resp = resp.json()
        print(f"    Broadcast response: {json.dumps(broadcast_resp, indent=2)[:500]}")
        return broadcast_resp.get("status") == "ok" or "payload" in broadcast_resp
    except:
        print(f"    Broadcast text: {resp.text[:300]}")
        return False

def main():
    username = sys.argv[1] if len(sys.argv) > 1 else "mwango_brain"
    password = sys.argv[2] if len(sys.argv) > 2 else "Jarvis99!"
    target = sys.argv[3] if len(sys.argv) > 3 else "instagram"
    message = sys.argv[4] if len(sys.argv) > 4 else "Ola! Teste de mensagem automatica. Ignora por favor."
    
    print(f"=== Instagram API Direct Login & DM ===")
    print(f"Username: {username}")
    print(f"Target: @{target}")
    print(f"Message: {message}")
    print()
    
    # Step 1
    csrftoken = step1_get_csrf_and_cookies()
    if not csrftoken:
        print("ERROR: Could not get CSRF token")
        sys.exit(1)
    
    # Step 2
    login_result = step2_login(username, password, csrftoken)
    
    if "logged_in_user" not in login_result and login_result.get("status") != "ok":
        print(f"\nLogin failed: {login_result.get('message', 'Unknown error')}")
        if "two_factor_required" in str(login_result):
            print("2FA is required. Cannot proceed.")
        sys.exit(1)
    
    print(f"\nLogin SUCCESS! User ID: {login_result.get('logged_in_user', {}).get('pk', 'unknown')}")
    print(f"Session cookies: csrftoken={session.cookies.get('csrftoken', '')[:10]}...")
    print(f"                 sessionid={session.cookies.get('sessionid', '')[:10]}...")
    print()
    
    # Step 3
    result = step3_send_dm(target, message, csrftoken)
    print(f"\n=== RESULT: {'DM SENT!' if result else 'DM FAILED'} ===")
    
    return result

if __name__ == "__main__":
    main()
