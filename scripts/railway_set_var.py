import json, urllib.request, urllib.error

TOKEN = '46bd76d6-4da3-48c4-b5be-24a91e6d5137'
URL = 'https://api.railway.app/graphql/v2'
HEADERS = {'Content-Type': 'application/json', 'Authorization': f'Bearer {TOKEN}'}

PROJECT_ID = '17256a66-27b2-41db-bef2-0d7f05c5e26b'
SERVICE_ID = '37a07126-6096-4b62-a43c-0615657bd460'
ENV_ID = 'acc6bfb1-9cd7-42ac-a862-fa1e14196a33'

def gql(query_str):
    data = json.dumps({'query': query_str}).encode()
    req = urllib.request.Request(URL, data=data, headers=HEADERS)
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode())

# Set BRIGHT_DATA_WS_ENDPOINT
print('=== Setting BRIGHT_DATA_WS_ENDPOINT ===')
r = gql(
    'mutation { variableUpsert(input: {'
    f'  projectId: "{PROJECT_ID}",'
    f'  environmentId: "{ENV_ID}",'
    f'  serviceId: "{SERVICE_ID}",'
    '  name: "BRIGHT_DATA_WS_ENDPOINT",'
    '  value: "wss://brd-customer-hl_97eb6daa-zone-aura:5wnxr21qxi5x@brd.superproxy.io:9222",'
    '  skipDeploys: true'
    '}) }'
)
print(json.dumps(r, indent=2))

# Verify it was set
print('\n=== VERIFYING ===')
r2 = gql(f'{{ variables(projectId: "{PROJECT_ID}", serviceId: "{SERVICE_ID}", environmentId: "{ENV_ID}") }}')
vars = r2.get('data', {}).get('variables', {})
if 'BRIGHT_DATA_WS_ENDPOINT' in vars:
    print(f"SUCCESS! BRIGHT_DATA_WS_ENDPOINT = {vars['BRIGHT_DATA_WS_ENDPOINT'][:50]}..."
    )
else:
    print('FAILED - variable not found')
    print('Current vars:', list(vars.keys()))
