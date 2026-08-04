#!/usr/bin/env python3
"""Try accessing Railway with correct project ID from worklog."""
import requests
import json

TOKEN = "46bd76d6-4da3-48c4-b5be-24a91e6d5137"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json",
}
GRAPHQL_URL = "https://backboard.railway.app/graphql/v2"

def gql(query):
    resp = requests.post(GRAPHQL_URL, headers=HEADERS, json={"query": query}, timeout=15)
    data = resp.json()
    if "errors" in data:
        print(f"  Errors: {json.dumps(data['errors'], indent=2)}")
        return None
    return data.get("data")

# Correct project ID from worklog
PROJECT_ID = "17256a66-27b2-41db-bef2-0d7f05c5e26b"
SERVICE_ID = "aa38ee6b-0828-4bc2-9828-7152b23f65c0"

print("=== Try correct project ID ===")
data = gql(f'{{ project(id: "{PROJECT_ID}") {{ id name }} }}')
print(json.dumps(data, indent=2))

print("\n=== Try correct service ID ===")
data = gql(f'{{ service(id: "{SERVICE_ID}") {{ id name }} }}')
print(json.dumps(data, indent=2))
