#!/usr/bin/env python3
"""Get Railway public URL and deployment status."""
import requests
import json

TOKEN = "46bd76d6-4da3-48c4-b5be-24a91e6d5137"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}
GRAPHQL_URL = "https://backboard.railway.app/graphql/v2"

SERVICE_ID = "aa38ee6b-0828-4bc2-9828-7152b23f65c0"
PROJECT_ID = "17256a66-27b2-41db-bef2-0d7f05c5e26b"


def gql(query):
    resp = requests.post(GRAPHQL_URL, headers=HEADERS, json={"query": query}, timeout=15)
    data = resp.json()
    if "errors" in data:
        print(f"  Errors: {json.dumps(data['errors'], indent=2)}")
        return None
    return data.get("data")

# Get service with basic fields
print("=== Service ===")
data = gql(f'''{{
  service(id: "{SERVICE_ID}") {{
    id
    name
    createdAt
  }}
}}''')
print(json.dumps(data, indent=2))

# Get project with basic fields  
print("\n=== Project ===")
data = gql(f'''{{
  project(id: "{PROJECT_ID}") {{
    id
    name
    createdAt
  }}
}}''')
print(json.dumps(data, indent=2))

# Get deployments for service
print("\n=== Deployments ===")
data = gql(f'''{{
  service(id: "{SERVICE_ID}") {{
    deployments {{
      edges {{
        node {{
          id
          status
          createdAt
        }}
      }}
    }}
  }}
}}''')
print(json.dumps(data, indent=2))

# Try to get the environment and its public domain
print("\n=== Environment ===")
ENV_ID = "acc6bfb1-9cd7-42ac-a862-fa1e14196a33"
data = gql(f'''{{
  environment(id: "{ENV_ID}") {{
    id
    name
    domain
  }}
}}''')
print(json.dumps(data, indent=2))