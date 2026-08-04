import json, urllib.request, urllib

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
        resp = urllib.request.urlopen(req, timeout=15)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode())

# Check VariableUpsertInput fields
print('=== VariableUpsertInput ===')
r = gql('{ __type(name: "VariableUpsertInput") { inputFields { name type { name kind ofType { name } } } } }')
print(json.dumps(r, indent=2))

# Check EnvironmentConfig type
print('\n=== EnvironmentConfig ===')
r2 = gql('{ __type(name: "EnvironmentConfig") { fields { name type { name kind ofType { name kind ofType { name } } } } } }')
print(json.dumps(r2, indent=2)[:3000])
