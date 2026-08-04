#!/usr/bin/env python3
"""Check Railway deployment status and get public URL."""
import requests
import json
import time

TOKEN = "46bd76d6-4da3-48c4-b5be-24a91e6d5137"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}
GRAPHQL_URL = "https://backboard.railway.app/graphql/v2"

SERVICE_ID = "aa38ee6b-0828-4bc2-9828-7152b23f65c0"
PROJECT_ID = "17256a66-27b2-41db-bef2-0d7f05c5e26b"

def gql(query, variables=None):
    payload = {"query": query}
    if variables:
        payload["variables"] = variables
    resp = requests.post(GRAPHQL_URL, headers=HEADERS, json=payload, timeout=15)
    data = resp.json()
    if "errors" in data:
        print(f"  Errors: {json.dumps(data['errors'], indent=2)}")
        return None
    return data.get("data")

# Get service details with deploy URL
print("=== Service details ===")
data = gql(f'''
{{
  service(id: "{SERVICE_ID}") {{
    id
    name
    domain
    serviceInstances {{
      edges {{
        node {{
          id
          status
        }}
      }}
    }}
  }}
}}
''')
print(json.dumps(data, indent=2))

# Get latest deployments
print("\n=== Latest deployments ===")
data = gql('''
query GetDeployments($input: DeploymentListInput!) {
  deployments(input: $input) {
    edges {
      node {
        id
        status
        createdAt
        updatedAt
      }
    }
  }
}
''', {"input": {"serviceId": SERVICE_ID, "count": 5}})
print(json.dumps(data, indent=2))

# Try to get the public domain for the project
print("\n=== Project domains ===")
data = gql(f'''
{{
  project(id: "{PROJECT_ID}") {{
    id
    name
    domain
  }}
}}
''')
print(json.dumps(data, indent=2))
