#!/usr/bin/env python3
"""
Copia OR_KEY e META_PAGE_TOKEN do Next.js para o aura-engine.
Corre localmente — pede os tokens ao utilizador e configura no Railway.
"""
import json
import urllib.request

RAILWAY_TOKEN = "2969030e-ace0-459b-aa27-fcb9f2f4a170"
GRAPHQL_URL = "https://backboard.railway.app/graphql/v2"
PROJECT_ID = "17256a66-27b2-41db-bef2-0d7f05c5e26b"
ENV_ID = "acc6bfb1-9cd7-42ac-a862-fa1e14196a33"
ENGINE_ID = "5ec1e283-b115-4c29-afef-95de32d3bb6d"

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
            print(f"  [{'OK' if ok else 'FALHA'}] {name} ({len(value)} chars)")
            return ok
    except Exception as e:
        print(f"  [ERRO] {name}: {e}")
        return False

print("=== Copiar Tokens para Aura Engine ===")
print("Pega os tokens no dashboard do Railway:")
print(f"  https://railway.app/project/{PROJECT_ID}/service/{ENGINE_ID}")
print("")
print("Variaveis que precisas copiar do servico 'aura-social-engine':")
print("  1. OR_KEY")
print("  2. META_PAGE_TOKEN")
print("  3. AURA_IG_COOKIES_B64 (opcional - se tiver)")
print("")

# Obter tokens do input do utilizador
or_key = input("Cola o OR_KEY: ").strip()
meta_token = input("Cola o META_PAGE_TOKEN: ").strip()
ig_cookies = input("Cola o AURA_IG_COOKIES_B64 (Enter para saltar): ").strip()

print("")
print("Configurando...")

if or_key:
    set_var("AI_API_KEY", or_key)
if meta_token:
    set_var("META_PAGE_TOKEN", meta_token)
if ig_cookies:
    set_var("AURA_IG_COOKIES_B64", ig_cookies)

print("")
print("Feito! Reinicia o engine para aplicar:")
print(f"  Railway: https://railway.app/project/{PROJECT_ID}/service/{ENGINE_ID}")
