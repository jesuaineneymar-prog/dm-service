import requests
import json

RAILWAY_TOKEN = '2969030e-ace0-459b-aa27-fcb9f2f4a170'
PROJECT_ID = '17256a66-27b2-41db-bef2-0d7f05c5e26b'
API = 'https://backboard.railway.app/graphql/v2'

HEADERS = { 'Authorization': 'Bearer ' + RAILWAY_TOKEN, 'Content-Type': 'application/json' }

def get_env_id():
    q = 'query($projectId: String!) { project(id: $projectId) { environments { id name } } }'
    r = requests.post(API, headers=HEADERS, json={'query': q, 'variables': {'projectId': PROJECT_ID}})
    data = r.json()
    envs = data.get('data', {}).get('project', {}).get('environments', [])
    if envs:
        return envs[0]['id']
    return None

def set_var(env_id, name, value):
    m = 'mutation($projectId: String!, $environmentId: String!, $name: String!, $value: String!) { variableUpsert(input: {projectId: $projectId, environmentId: $environmentId, name: $name, value: $value}) }'
    r = requests.post(API, headers=HEADERS, json={'query': m, 'variables': {'projectId': PROJECT_ID, 'environmentId': env_id, 'name': name, 'value': value}})
    data = r.json()
    if data.get('errors'):
        return False, data['errors'][0]['message']
    return True, 'ok'

env_id = get_env_id()
print(f'Environment ID: {env_id}')

# Set RAILWAY_API_TOKEN and GitHub token
vars = {
    'RAILWAY_API_TOKEN': '2969030e-ace0-459b-aa27-fcb9f2f4a170',
}

for name, value in vars.items():
    ok, msg = set_var(env_id, name, value)
    print(f'{name}: {"OK" if ok else "FAIL: " + msg}')

print('Done!')
