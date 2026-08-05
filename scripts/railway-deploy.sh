#!/bin/bash
# Aura v4 — Deploy no Railway via GraphQL
set -e

RAILWAY_TOKEN="2969030e-ace0-459b-aa27-fcb9f2f4a170"
PROJECT_ID="17256a66-27b2-41db-bef2-0d7f05c5e26b"
NEXT_SERVICE_ID="aa38ee6b-0828-4bc2-9828-7152b23f65c0"
GRAPHQL_URL="https://backboard.railway.app/graphql/v2"
ENV_ID="acc6bfb1-9cd7-42ac-a862-fa1e14196a33"

gql() {
  curl -s -X POST "$GRAPHQL_URL" \
    -H "Authorization: Bearer $RAILWAY_TOKEN" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Mozilla/5.0" \
    -d "$1"
}

set_var() {
  local SID="$1" NAME="$2" VALUE="$3"
  local ESCAPED=$(python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))" <<< "$VALUE")
  local Q='{"query":"mutation($p:String!,$e:String!,$n:String!,$v:String!){variableUpsert(input:{projectId:$p,environmentId:$e,name:$n,value:$v})}","variables":{"p":"'$PROJECT_ID'","e":"'$ENV_ID'","s":"'$SID'","n":"'$NAME'","v":'$ESCAPED'}}'
  local RESULT=$(gql "$Q")
  if echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if 'variableUpsert' in d.get('data',{}) else 1)" 2>/dev/null; then
    echo "  [OK] $NAME"
  else
    echo "  [!] $NAME: $(echo $RESULT | head -c 100)"
  fi
}

echo "=== Aura v4 Railway Deploy ==="
echo ""

# Step 1: Criar servico aura-engine
echo '[1/4] Criando servico aura-engine...'
CREATE_RESULT=$(gql '{"query":"mutation{serviceCreate(input:{projectId:\"'$PROJECT_ID'\",name:\"aura-engine\",source:{repo:\"jesuaineneymar-prog/dm-service\",branch:\"main\",rootDirectory:\"aura-engine\"}}){id name}}"}')
ENGINE_ID=$(echo "$CREATE_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('serviceCreate',{}).get('id',''))" 2>/dev/null)

if [ -z "$ENGINE_ID" ]; then
  echo '  Servico ja existe, a procurar...'
  LIST=$(gql '{"query":"{project(id:\"'$PROJECT_ID'\"){services{edges{node{id name}}}}}"} ')
  ENGINE_ID=$(echo "$LIST" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for e in d.get('data',{}).get('project',{}).get('services',{}).get('edges',[]):
    n=e.get('node',{})
    if 'aura-engine' in n.get('name',''):
        print(n['id'])
        break
" 2>/dev/null)
fi

echo "  Engine ID: $ENGINE_ID"
if [ -z "$ENGINE_ID" ]; then echo 'ERRO: Nao conseguiu criar/encontrar servico'; exit 1; fi

echo ""
echo '[2/4] Configurando env vars do aura-engine...'

# Obter tokens do servico Next.js
NEXT_VARS=$(gql '{"query":"{project(id:\"'$PROJECT_ID'\"){services{edges{node{id name variables{edges{node{name value}}}}}}}}"}')
META_TOKEN=$(echo "$NEXT_VARS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for e in d.get('data',{}).get('project',{}).get('services',{}).get('edges',[]):
    n=e.get('node',{})
    if n.get('id')=='$NEXT_SERVICE_ID':
        for v in n.get('variables',{}).get('edges',[]):
            vn=v.get('node',{})
            if vn.get('name')=='META_PAGE_TOKEN': print(vn.get('value',''))
" 2>/dev/null)

OR_KEY=$(echo "$NEXT_VARS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for e in d.get('data',{}).get('project',{}).get('services',{}).get('edges',[]):
    n=e.get('node',{})
    if n.get('id')=='$NEXT_SERVICE_ID':
        for v in n.get('variables',{}).get('edges',[]):
            vn=v.get('node',{})
            if vn.get('name')=='OR_KEY': print(vn.get('value',''))
" 2>/dev/null)

set_var "$ENGINE_ID" "AUTH_PASSWORD" "Jarvis99!"
set_var "$ENGINE_ID" "JWT_SECRET" "aura-super-secret-key-2024"
set_var "$ENGINE_ID" "IG_USERNAME" "76810989322"
set_var "$ENGINE_ID" "IG_PASSWORD" "X2VpFZY@)u-H%89"
set_var "$ENGINE_ID" "META_PAGE_TOKEN" "${META_TOKEN:-}"
set_var "$ENGINE_ID" "FB_PAGE_ID" "1271692609354364"
set_var "$ENGINE_ID" "AI_API_KEY" "${OR_KEY:-}"
set_var "$ENGINE_ID" "AUTO_REPLY_ENABLED" "true"
set_var "$ENGINE_ID" "NIXPACKS_PYTHON_VERSION" "3.12"

echo ""
echo '[3/4] Configurando AURA_ENGINE_URL no Next.js...'
set_var "$NEXT_SERVICE_ID" "AURA_ENGINE_URL" "http://aura-engine.railway.internal:8000"
set_var "$NEXT_SERVICE_ID" "RAILWAY_API_TOKEN" "$RAILWAY_TOKEN"
set_var "$NEXT_SERVICE_ID" "RAILWAY_ENV_ID" "$ENV_ID"
set_var "$NEXT_SERVICE_ID" "RAILWAY_PROJECT_ID" "$PROJECT_ID"

echo ""
echo '[4/4] Reiniciando servicos...'
gql '{"query":"mutation{serviceRestart(input:{id:\"'$NEXT_SERVICE_ID'\"}){id}}"}' > /dev/null && echo "  Next.js reiniciado"
gql '{"query":"mutation{serviceRestart(input:{id:\"'$ENGINE_ID'\"}){id}}"}' > /dev/null && echo "  aura-engine reiniciado"

echo ""
echo '=== DEPLOY COMPLETO ==='
echo "Next.js: $NEXT_SERVICE_ID"
echo "Engine:  $ENGINE_ID"
echo ""
echo 'Espera 2-3 min para os servicos arrancarem.'
echo 'Depois testa: POST /api/engine { action: "engine_health" }'