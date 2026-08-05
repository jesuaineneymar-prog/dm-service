#!/usr/bin/env python3
import json
import urllib.request
import sys

RAILWAY_TOKEN = "2969030e-ace0-459b-aa27-fcb9f2f4a170"
PROJECT_ID = "17256a66-27b2-41db-bef2-0d7f05c5e26b"
ENV_ID = "acc6bfb1-9cd7-42ac-a862-fa1e14196a33"
GRAPHQL_URL = "https://backboard.railway.app/graphql/v2"

def set_var(service_id, name, value):
    payload = {
        "query": """mutation($p: String!, $e: String!, $s: String!, $n: String!, $v: String!) {
            variableUpsert(input: {projectId: $p, environmentId: $e, serviceId: $s, name: $n, value: $v})
        }""",
        "variables": {
            "p": PROJECT_ID,
            "e": ENV_ID,
            "s": service_id,
            "n": name,
            "v": value
        }
    }
    data = json.dumps(payload).encode()
    req = urllib.request.Request(GRAPHQL_URL, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {RAILWAY_TOKEN}")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "Mozilla/5.0")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode())
            ok = "variableUpsert" in result.get("data", {})
            print(f"  [{'OK' if ok else '!!'}] {name}")
            return ok
    except Exception as e:
        print(f"  [ERR] {name}: {e}")
        return False

ENGINE_ID = "5ec1e283-b115-4c29-afef-95de32d3bb6d"
NEXT_ID = "aa38ee6b-0828-4bc2-9828-7152b23f65c0"

print("=== Engine env vars ===")
for name, val in [
    ("AUTH_PASSWORD", "Jarvis99!"),
    ("JWT_SECRET", "aura-super-secret-key-2024"),
    ("IG_USERNAME", "76810989322"),
    ("IG_PASSWORD", "X2VpFZY@)u-H%89"),
    ("FB_PAGE_ID", "1271692609354364"),
    ("AUTO_REPLY_ENABLED", "true"),
    ("NIXPACKS_PYTHON_VERSION", "3.12"),
]:
    set_var(ENGINE_ID, name, val)

print("")
print("=== Next.js env vars ===")
for name, val in [
    ("AURA_ENGINE_URL", "http://aura-engine.railway.internal:8000"),
    ("RAILWAY_API_TOKEN", RAILWAY_TOKEN),
    ("RAILWAY_ENV_ID", ENV_ID),
    ("RAILWAY_PROJECT_ID", PROJECT_ID),
]:
    set_var(NEXT_ID, name, val)