#!/usr/bin/env python3
"""
Aura v4 — Deploy no Railway
Cria servico aura-engine e configura env vars
"""
import json
import sys
import urllib.request
import urllib.error

RAILWAY_TOKEN = "2969030e-ace0-459b-aa27-fcb9f2f4a170"
PROJECT_ID = "17256a66-27b2-41db-bef2-0d7f05c5e26b"
NEXT_SERVICE_ID = "aa38ee6b-0828-4bc2-9828-7152b23f65c0"
GRAPHQL_URL = "https://backboard.railway.app/graphql/v2"

def graphql(query, variables=None):
    """Executa query GraphQL no Railway API."""
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    data = json.dumps(payload).encode()
    req = urllib.request.Request(GRAPHQL_URL, data=data, method="POST")
    req.add_header("Authorization", f"Bearer {RAILWAY_TOKEN}")
    req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode()[:200]}")
        return {}

def find_service_by_name(name):
    """Encontra servico por nome no projecto."""
    result = graphql(
        '{ project(id: "' + PROJECT_ID + '") { services { edges { node { id name } } } } }'
    )
    for edge in result.get('data', {}).get('project', {}).get('services', {}).get('edges', []):
        node = edge.get('node', {})
        if name in node.get('name', ''):
            return node['id']
    return None

def get_environment_id():
    """Obtem o environment ID (Production)."""
    result = graphql(
        '{ project(id: "' + PROJECT_ID + '") { environments { edges { node { id name } } } } }'
    )
    for edge in result.get('data', {}).get('project', {}).get('environments', {}).get('edges', []):
        node = edge.get('node', {})
        if node.get('name') == 'Production':
            return node['id']
        return node.get('id')  # fallback
    return None

def set_env_var(service_id, env_id, name, value):
    """Configura uma env var no Railway."""
    result = graphql(
        'mutation($projectId: String!, $environmentId: String!, $name: String!, $value: String!) '
        '{ variableUpsert(input: { projectId: $projectId, environmentId: $environmentId, name: $name, value: $value }) }',
        {"projectId": PROJECT_ID, "environmentId": env_id, "name": name, "value": value}
    )
    has_error = 'errors' in result
    status = 'OK' if not has_error else 'FALHA'
    print(f'  [{status}] {name}')
    return not has_error

def restart_service(service_id):
    """Reinicia um servico."""
    result = graphql(
        'mutation { serviceRestart(input: { id: "' + service_id + '" }) { id } }'
    )
    return 'errors' not in result

# ============================================================
# MAIN
# ============================================================
print('=== Aura v4 Railway Deploy ===')
print()

# Step 1: Criar servico aura-engine
print('[1/5] Criando servico aura-engine...')
engine_id = find_service_by_name('aura-engine')

if engine_id:
    print(f'  Servico ja existe: {engine_id}')
else:
    result = graphql(
        'mutation { serviceCreate(input: { '
        'projectId: "' + PROJECT_ID + '", '
        'name: "aura-engine", '
        'source: { repo: "jesuaineneymar-prog/dm-service", branch: "main", rootDirectory: "aura-engine" } '
        '}) { id name } }'
    )
    engine_id = result.get('data', {}).get('serviceCreate', {}).get('id', '')
    if engine_id:
        print(f'  Criado: {engine_id}')
    else:
        print(f'  Erro: {json.dumps(result)[:200]}')
        sys.exit(1)

# Step 2: Obter env ID
print('[2/5] Obtendo environment ID...')
env_id = get_environment_id()
print(f'  Environment: {env_id}')

if not env_id:
    print('ERRO: Nao conseguiu obter environment ID')
    sys.exit(1)

# Step 3: Configurar env vars do engine
print('[3/5] Configurando env vars do aura-engine...')
engine_vars = [
    ("AUTH_PASSWORD", "Jarvis99!"),
    ("JWT_SECRET", "aura-super-secret-key-2024"),
    ("IG_USERNAME", "76810989322"),
    ("IG_PASSWORD", "X2VpFZY@)u-H%89"),
    ("META_PAGE_TOKEN", ""),  # Sera preenchido depois
    ("FB_PAGE_ID", "1271692609354364"),
    ("AI_API_KEY", ""),  # Sera preenchido depois
    ("AUTO_REPLY_ENABLED", "true"),
    ("NIXPACKS_PYTHON_VERSION", "3.12"),
]

# Tentar obter o META_PAGE_TOKEN e OR_KEY do servico Next.js
print('[3a/5] Obtendo tokens do servico Next.js...')
next_vars_result = graphql(
    '{ project(id: "' + PROJECT_ID + '") { services { edges { node { id name variables { edges { node { name value } } } } } } } }'
)
next_token_value = ""
or_key_value = ""
for edge in next_vars_result.get('data', {}).get('project', {}).get('services', {}).get('edges', []):
    node = edge.get('node', {})
    if node.get('id') == NEXT_SERVICE_ID:
        for vedge in node.get('variables', {}).get('edges', []):
            v = vedge.get('node', {})
            if v.get('name') == 'META_PAGE_TOKEN':
                next_token_value = v.get('value', '')
            elif v.get('name') == 'OR_KEY':
                or_key_value = v.get('value', '')
        break

if next_token_value:
    engine_vars[4] = ("META_PAGE_TOKEN", next_token_value)
    print(f'  META_PAGE_TOKEN copiado ({len(next_token_value)} chars)')
if or_key_value:
    engine_vars[6] = ("AI_API_KEY", or_key_value)
    print(f'  AI_API_KEY copiado ({len(or_key_value)} chars)')

for name, value in engine_vars:
    set_env_var(engine_id, env_id, name, value)

# Step 4: Configurar Next.js
print('[4/5] Configurando AURA_ENGINE_URL no Next.js...')
set_env_var(NEXT_SERVICE_ID, env_id, "AURA_ENGINE_URL", "http://aura-engine.railway.internal:8000")
set_env_var(NEXT_SERVICE_ID, env_id, "RAILWAY_API_TOKEN", RAILWAY_TOKEN)
set_env_var(NEXT_SERVICE_ID, env_id, "RAILWAY_ENV_ID", env_id)
set_env_var(NEXT_SERVICE_ID, env_id, "RAILWAY_PROJECT_ID", PROJECT_ID)

# Step 5: Redeploy
print('[5/5] Reiniciando servicos...')
print('  Reiniciando Next.js...')
restart_service(NEXT_SERVICE_ID)
print('  Reiniciando aura-engine...')
restart_service(engine_id)

print()
print('=== DEPLOY COMPLETO ===')
print(f'Next.js: {NEXT_SERVICE_ID}')
print(f'Engine:  {engine_id}')
print(f'Env:     {env_id}')
print()
print('Espera 2-3 min para os servicos arrancarem.')
print('Depois testa: POST /api/engine { action: "engine_health" }')
