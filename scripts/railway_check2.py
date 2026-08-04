#!/usr/bin/env python3
import requests, json

TOKEN = '46bd76d6-4da3-48c4-b5be-24a91e6d5137'
HEADERS = {'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'}
GRAPHQL_URL = 'https://backboard.railway.app/graphql/v2'

SERVICE_ID = 'aa38ee6b-0828-4bc2-9828-7152b23f65c0'

r = requests.post(GRAPHQL_URL, headers=HEADERS, json={'query': f'{{ service(id: "{SERVICE_ID}") {{ deployments {{ edges {{ node {{ id status createdAt build {{ id status }} }} }} }} }}'}}, timeout=15)
try:
    deps = r.json()['data']['service']['deployments']['edges']
    for d in deps[:5]:
        dep = d['node']
        print(f"{dep['createdAt']}  {dep['status']:10s}  build:{dep['build']['status']:12s}  {dep['id'][:12]}")
except Exception as e:
    print(f'Error: {e}')
    print(r.text[:500])