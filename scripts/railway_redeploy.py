#!/usr/bin/env python3
import requests, json

TOKEN = '46bd76d6-4da3-48c4-b5be-24a91e6d5137'
HEADERS = {'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'}
GRAPHQL_URL = 'https://backboard.railway.app/graphql/v2'

SERVICE_ID = 'aa38ee6b-0828-4bc2-9828-7152b23f65c0'
ENV_ID = 'acc6bfb1-9cd7-42ac-a862-fa1e14196a33'

# Get latest deployment
r = requests.post(GRAPHQL_URL, headers=HEADERS, json={'query': f'{{ service(id: "{SERVICE_ID}") {{ deployments(first: 1) {{ edges {{ node {{ id status createdAt }} }} }} }}'}, timeout=15).json()
dep = r['data']['service']['deployments']['edges'][0]['node']
print(f'Latest: {dep["status"]} at {dep["createdAt"]}')

# Trigger redeploy by creating and deleting a dummy env var
# Get current vars
r2 = requests.post(GRAPH_URL, headers=HEADERS, json={'query': f'{{ environment(id: "{ENV_ID}") {{ id }} }}'}, timeout=15).json()

# Alternative: restart deployment
print('Trying to restart deployment...')

r3 = requests.post(GRAPH_URL, headers=HEADERS, json={'query': '{ deploymentRestart(input: {id: "' + dep['id'] + '"}) { id status } }'}, timeout=15).json()
print(json.dumps(r3, indent=2))
