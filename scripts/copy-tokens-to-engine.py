#!/usr/bin/env python3
"""Copia OR_KEY e META_PAGE_TOKEN do Next.js para o aura-engine.
Como o Railway API v2 nao permite ler valores, usamos
o endpoint do Next.js para obter os tokens e configurar no engine."""
import json
import urllib.request

RAILWAY_TOKEN = "2969030e-ace0-459b-aa27-fcb9f2f4a170"
GRAPHQL_URL = "https://backboard.railway.app/graphql/v2"
PROJECT_ID = "17256a66-27b2-41db-bef2-0d7f05c5e26b"
ENV_ID = "acc6bfb1-9cd7-42ac-a862-fa1e14196a33"
ENGINE_ID = "5ec1e283-b115-4c29-afef-95de32d3bb6d"
NEXT_ID = "aa38ee6b-0828-4bc2-9828-7152b23f65c0"
NEXT_URL = "https://aura-social-engine-production.up.railway.app"

def set_var(name, value):
    payload = {
        "query": """mutation($p: String!, $e: String!, $s: String!, $n: String!, $v: String!) {
            variableUpsert(input: {projectId: $p, environmentId: $e, serviceId: $s, name: $n, value: $v})
        }""",
        "variables": {
            "p": PROJECT_ID, "e": ENV_ID, "s": ENGINE_ID,
            "n": name, "v": value
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
            print(f"  [{'OK' if ok else '!!'}] {name} ({len(value)} chars)")
            return ok
    except Exception as e:
        print(f"  [ERR] {name}: {e}")
        return False

# Try to get tokens from the Next.js health endpoint
print("Obtendo tokens do Next.js...")
try:
    req = urllib.request.Request(NEXT_URL + "/api/health")
    with urllib.request.urlopen(req, timeout=10) as resp:
        health = json.loads(resp.read().decode())
        print(f"  Health: {health.get('status', 'unknown')}")
except Exception as e:
    print(f"  Erro ao aceder health: {e}")

print("\nNOTA: Nao e possivel ler tokens do Railway API v2 (seguranca).")
print("Precisas configurar manualmente no dashboard do Railway:")
print(f"  Servico: aura-engine ({ENGINE_ID})")
print("  Variaveis a adicionar:")
print("    OR_KEY = (copiar do servico aura-social-engine)")
print("    META_PAGE_TOKEN = (copiar do servico aura-social-engine)")
print("    AURA_IG_COOKIES_B64 = (copiar do servico aura-social-engine)")
print("    AURA_FB_COOKIES_B64 = (copiar do servico aura-social-engine)")
