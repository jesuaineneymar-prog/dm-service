#!/bin/bash
# ============================================================
#  Aura v4 — Deploy completo no Railway
#  1. Cria servico Python aura-engine
#  2. Configura env vars nos dois servicos
#  3. Faz push para GitHub (trigger auto-deploy)
# ============================================================

set -e

RAILWAY_TOKEN="2969030e-ace0-459b-aa27-fcb9f2f4a170"
PROJECT_ID="17256a66-27b2-41db-bef2-0d7f05c5e26b"
NEXT_SERVICE_ID="aa38ee6b-0828-4bc2-9828-7152b23f65c0"
GRAPHQL_URL="https://backboard.railway.app/graphql/v2"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

graphql() {
  local query="$1"
  curl -s -X POST "$GRAPHQL_URL" \
    -H "Authorization: Bearer $RAILWAY_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$query"
}

# ============================================================
# STEP 1: Criar servico Python aura-engine
# ============================================================
log_info "Criando servico aura-engine no Railway..."

# Criar servico
CREATE_SERVICE=$(cat <<EOF
{"query": "mutation { serviceCreate(input: { projectId: \"$PROJECT_ID\", name: \"aura-engine\", source: { repo: \"jesuaineneymar-prog/dm-service\", branch: \"main\", rootDirectory: \"aura-engine\" } }) { id name } }"}
EOF
)

SERVICE_RESULT=$(graphql "$CREATE_SERVICE")
ENGINE_SERVICE_ID=$(echo "$SERVICE_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('serviceCreate',{}).get('id',''))" 2>/dev/null || echo "")

if [ -z "$ENGINE_SERVICE_ID" ]; then
  log_warn "Nao conseguiu criar servico (talvez ja exista). A procurar..."
  # Listar servicos existentes
  LIST_QUERY=$(cat <<EOF
{"query": "{ project(id: \"$PROJECT_ID\") { services { edges { node { id name } } } } }"}
EOF
)
  SERVICES=$(graphql "$LIST_QUERY")
  ENGINE_SERVICE_ID=$(echo "$SERVICES" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for e in d.get('data',{}).get('project',{}).get('services',{}).get('edges',[]):
    n=e.get('node',{})
    if 'aura-engine' in n.get('name',''):
        print(n['id'])
        break
" 2>/dev/null || echo "")
fi

if [ -z "$ENGINE_SERVICE_ID" ]; then
  log_error "Nao conseguiu encontrar/criar servico aura-engine"
  exit 1
fi

log_info "Servico aura-engine: $ENGINE_SERVICE_ID"

# ============================================================
# STEP 2: Obter environment IDs
# ============================================================
log_info "Obtendo environment IDs..."

ENV_QUERY=$(cat <<EOF
{"query": "{ project(id: \"$PROJECT_ID\") { environments { edges { node { id name } } } } }"}
EOF
)
ENV_RESULT=$(graphql "$ENV_QUERY")
ENV_ID=$(echo "$ENV_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for e in d.get('data',{}).get('project',{}).get('environments',{}).get('edges',[]):
    n=e.get('node',{})
    if n.get('name')=='Production':
        print(n['id'])
        break
" 2>/dev/null || echo "")

if [ -z "$ENV_ID" ]; then
  ENV_ID=$(echo "$ENV_RESULT" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for e in d.get('data',{}).get('project',{}).get('environments',{}).get('edges',[]):
    print(e.get('node',{}).get('id',''))
    break
" 2>/dev/null || echo "")
fi

log_info "Environment ID: $ENV_ID"

# ============================================================
# STEP 3: Configurar env vars do Python Engine
# ============================================================
log_info "Configurando env vars do aura-engine..."

set_var() {
  local SERVICE_ID="$1"
  local NAME="$2"
  local VALUE="$3"
  
  local MUTATION=$(cat <<EOF
{"query": "mutation(\$projectId: String!, \$environmentId: String!, \$name: String!, \$value: String!) { variableUpsert(input: { projectId: \$projectId, environmentId: \$environmentId, name: \$name, value: \$value }) }", "variables": {"projectId": "$PROJECT_ID", "environmentId": "$ENV_ID", "name": "$NAME", "value": "$VALUE"}}
EOF
)
  
  RESULT=$(graphql "$MUTATION")
  if echo "$RESULT" | rg -q "variableUpsert"; then
    log_info "  $NAME = configurado"
  else
    log_warn "  $NAME = falha: $(echo $RESULT | head -c 100)"
  fi
}

# Env vars do Python engine
set_var "$ENGINE_SERVICE_ID" "AUTH_PASSWORD" "Jarvis99!"
set_var "$ENGINE_SERVICE_ID" "JWT_SECRET" "aura-super-secret-key-2024"
set_var "$ENGINE_SERVICE_ID" "IG_USERNAME" "76810989322"
set_var "$ENGINE_SERVICE_ID" "IG_PASSWORD" "X2VpFZY@)u-H%89"
set_var "$ENGINE_SERVICE_ID" "AURA_IG_COOKIES_B64" "${AURA_IG_COOKIES_B64:-}"
set_var "$ENGINE_SERVICE_ID" "META_PAGE_TOKEN" "${META_PAGE_TOKEN:-}"
set_var "$ENGINE_SERVICE_ID" "FB_PAGE_ID" "1271692609354364"
set_var "$ENGINE_SERVICE_ID" "AI_API_KEY" "${OR_KEY:-}"
set_var "$ENGINE_SERVICE_ID" "AUTO_REPLY_ENABLED" "true"
set_var "$ENGINE_SERVICE_ID" "NIXPACKS_PYTHON_VERSION" "3.12"

# ============================================================
# STEP 4: Configurar AURA_ENGINE_URL no Next.js
# ============================================================
log_info "Configurando AURA_ENGINE_URL no servico Next.js..."
set_var "$NEXT_SERVICE_ID" "AURA_ENGINE_URL" "http://aura-engine.railway.internal:8000"
set_var "$NEXT_SERVICE_ID" "RAILWAY_API_TOKEN" "$RAILWAY_TOKEN"
set_var "$NEXT_SERVICE_ID" "RAILWAY_ENV_ID" "$ENV_ID"
set_var "$NEXT_SERVICE_ID" "RAILWAY_PROJECT_ID" "$PROJECT_ID"

# ============================================================
# STEP 5: Trigger redeploy do Next.js
# ============================================================
log_info "Triggering redeploy do Next.js..."

REDEPLOY=$(cat <<EOF
{"query": "mutation { serviceRestart(input: { id: \"$NEXT_SERVICE_ID\" }) { id } }"}
EOF
)
REDEPLOY_RESULT=$(graphql "$REDEPLOY")
log_info "Redeploy Next.js: $(echo $REDEPLOY_RESULT | head -c 100)"

# ============================================================
# STEP 6: Deploy do Python Engine
# ============================================================
log_info "Deploying aura-engine..."

DEPLOY_QUERY=$(cat <<EOF
{"query": "mutation { serviceRestart(input: { id: \"$ENGINE_SERVICE_ID\" }) { id } }"}
EOF
)
DEPLOY_RESULT=$(graphql "$DEPLOY_QUERY")
log_info "Deploy aura-engine: $(echo $DEPLOY_RESULT | head -c 100)"

# ============================================================
# DONE
# ============================================================
echo ""
log_info "=== DEPLOY COMPLETO ==="
log_info "Next.js service: $NEXT_SERVICE_ID"
log_info "Python engine: $ENGINE_SERVICE_ID"
log_info "AURA_ENGINE_URL configurada no Next.js"
echo ""
log_info "Proximos passos:"
log_info "1. Espera 2-3 minutos para os servicos arrancarem"
log_info "2. Importa cookies IG no engine: POST /api/engine { action: 'import_cookies', platform: 'instagram', cookies: [...] }"
log_info "3. Verifica health: POST /api/engine { action: 'engine_health' }"
log_info "4. Testa DM: POST /api/engine { action: 'send_dm', platform: 'instagram', target: 'username' }"
