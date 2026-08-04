#!/usr/bin/env python3
"""Get Railway public domain/URL."""
import requests
import json

TOKEN = "46bd76d6-4da3-48c4-b5be-24a91e6d5137"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}
GRAPHQL_URL = "https://backboard.railway.app/graphql/v2"

PROJECT_ID = "17256a66-27b2-41db-bef2-0d7f05c5e26b"
ENV_ID = "acc6bfb1-9cd7-42ac-a862-fa1e14196a33"
SERVICE_ID = "aa38ee6b-0828-4bc2-9828-7152b23f65c0"

def gql(query):
    resp = requests.post(GRAPHQL_URL, headers=HEADERS, json={"query": query}, timeout=15)
    data = resp.json()
    if "errors" in data:
        print(f"  Errors: {json.dumps(data['errors'], indent=2)}")
        return None
    return data.get("data")

# Get deployment with URL
print("=== Latest deployment details ===")
DEPLOY_ID = "d7473d64-a95b-4978-9337-3699e3c6e27d"
data = gql(f'''{{
  deployment(id: "{DEPLOY_ID}") {{
    id
    status
    url
    domain
  }}
}}''')
print(json.dumps(data, indent=2))

# Try environment domains
print("\n=== Environment details ===")
data = gql(f'''{{
  environment(id: "{ENV_ID}") {{
    id
    name
  }}
}}''')
print(json.dumps(data, indent=2))
